#!/usr/bin/env python3
# pack.py - Complete Python CLI client for PackCDN

import click
import requests
import json
import os
import sys
import hashlib
import base64
from pathlib import Path
import shutil
import tarfile
from datetime import datetime
from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
from rich.panel import Panel
from rich import print as rprint
from rich.prompt import Confirm
from rich.tree import Tree

console = Console()
PACKCDN_URL = "https://packcdn.firefly-worker.workers.dev"
CONFIG_DIR = Path.home() / ".pack"
INSTALL_DIR = CONFIG_DIR / "packages"
CACHE_DIR = CONFIG_DIR / "cache"
CONFIG_FILE = CONFIG_DIR / "config.json"

# Create directories
CONFIG_DIR.mkdir(exist_ok=True)
INSTALL_DIR.mkdir(exist_ok=True)
CACHE_DIR.mkdir(exist_ok=True)

# Default config
DEFAULT_CONFIG = {
    "registry": PACKCDN_URL,
    "default_install_path": str(Path.cwd() / "pack_modules"),
    "global_install_path": "/usr/local/lib/pack",
    "api_key": None,
    "username": None,
    "cache_enabled": True,
    "cache_ttl": 3600
}

def load_config():
    """Load configuration from file"""
    if CONFIG_FILE.exists():
        with open(CONFIG_FILE) as f:
            return {**DEFAULT_CONFIG, **json.load(f)}
    return DEFAULT_CONFIG

def save_config(config):
    """Save configuration to file"""
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)

@click.group()
def cli():
    """PackCDN Package Manager - Ultimate Package Distribution
    
    A modern package manager with WebAssembly support, private packages,
    and global CDN delivery.
    """
    pass

# ============================================================================
# INSTALL COMMAND - UPDATED TO USE CORRECT API ENDPOINT
# ============================================================================

@cli.command()
@click.argument('package_spec')
@click.option('--version', '-v', help='Specific version to install')
@click.option('--global/--local', '-g', 'global_install', default=False, help='Install globally')
@click.option('--save', '-S', is_flag=True, help='Save to package.json')
@click.option('--save-dev', '-D', is_flag=True, help='Save to devDependencies')
@click.option('--force', '-f', is_flag=True, help='Force reinstall')
@click.option('--no-cache', is_flag=True, help='Bypass cache')
def install(package_spec, version, global_install, save, save_dev, force, no_cache):
    """Install a package from PackCDN
    
    Examples:
    
        pack install 53wmnh9al9tml4fbq8z
        pack install Galaxies
        pack install Galaxies@0.0.1
    """
    config = load_config()
    
    # Parse package spec (handle both ID and name@version formats)
    package_id = package_spec
    package_version = version
    
    if '@' in package_spec and not version:
        package_id, package_version = package_spec.split('@', 1)
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        console=console
    ) as progress:
        
        # Task 1: Fetch package info from API
        task1 = progress.add_task(f"🔍 Fetching {package_id}...", total=None)
        
        try:
            # Use the API endpoint that returns JSON
            params = {'id': package_id}
            if package_version:
                params['version'] = package_version
            if no_cache:
                params['no_cache'] = '1'
            
            # Check cache first
            cache_key = f"{package_id}_{package_version or 'latest'}"
            cache_file = CACHE_DIR / f"{hashlib.md5(cache_key.encode()).hexdigest()}.json"
            
            if cache_file.exists() and not no_cache and not force:
                cache_age = datetime.now().timestamp() - cache_file.stat().st_mtime
                if cache_age < config.get('cache_ttl', 3600):
                    with open(cache_file, encoding='utf-8') as f:
                        data = json.load(f)
                    progress.update(task1, completed=True)
                    console.print("[dim]📦 Loaded from cache[/dim]")
                else:
                    # Cache expired, fetch fresh
                    response = requests.get(
                        f"{config['registry']}/api/get-pack",
                        params=params,
                        headers={'Accept': 'application/json'}
                    )
                    response.raise_for_status()
                    data = response.json()
                    with open(cache_file, 'w', encoding='utf-8') as f:
                        json.dump(data, f)
                    progress.update(task1, completed=True)
            else:
                # Fetch fresh
                response = requests.get(
                    f"{config['registry']}/api/get-pack",
                    params=params,
                    headers={'Accept': 'application/json'}
                )
                response.raise_for_status()
                data = response.json()
                
                if config.get('cache_enabled') and not no_cache:
                    with open(cache_file, 'w', encoding='utf-8') as f:
                        json.dump(data, f)
                
                progress.update(task1, completed=True)
            
            if not data.get('success'):
                console.print(f"[red]✗ Installation failed: {data.get('error', {}).get('message', 'Unknown error')}[/red]")
                return
            
            pack = data['pack']
            
            # Task 2: Determine install path
            task2 = progress.add_task(f"📁 Preparing installation directory...", total=None)
            
            if global_install:
                install_path = Path(config.get('global_install_path'))
            else:
                # Check for package.json in current directory
                if (Path.cwd() / 'package.json').exists():
                    install_path = Path.cwd() / 'node_modules'
                else:
                    install_path = Path.cwd() / 'pack_modules'
            
            package_dir = install_path / (pack.get('name') or pack['id'])
            
            if package_dir.exists() and not force:
                progress.update(task2, completed=True)
                console.print(f"[yellow]⚠ Package already installed. Use --force to reinstall.[/yellow]")
                return
            
            # Create directory
            package_dir.mkdir(parents=True, exist_ok=True)
            progress.update(task2, completed=True)
            
            # Task 3: Download files
            task3 = progress.add_task(f"📥 Downloading files...", total=len(pack.get('files', {})))
            
            for filename, content in pack.get('files', {}).items():
                file_path = package_dir / filename
                file_path.parent.mkdir(parents=True, exist_ok=True)
                
                # Handle different content types
                if isinstance(content, str):
                    if content.startswith('data:'):
                        # Handle base64 encoded content
                        content_type, content_data = content.split(',', 1)
                        file_content = base64.b64decode(content_data)
                        with open(file_path, 'wb') as f:
                            f.write(file_content)
                    else:
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(content)
                else:
                    with open(file_path, 'wb') as f:
                        f.write(content)
                
                progress.update(task3, advance=1)
            
            # Save package info
            with open(package_dir / 'pack-info.json', 'w', encoding='utf-8') as f:
                json.dump(pack, f, indent=2)
            
            progress.update(task3, completed=True)
            
            # Save to package.json if requested
            if save or save_dev:
                package_json_path = Path.cwd() / 'package.json'
                if package_json_path.exists():
                    with open(package_json_path, encoding='utf-8') as f:
                        package_json = json.load(f)
                    
                    dep_type = 'devDependencies' if save_dev else 'dependencies'
                    if dep_type not in package_json:
                        package_json[dep_type] = {}
                    
                    package_json[dep_type][pack.get('name', pack['id'])] = f"^{pack.get('version', '1.0.0')}"
                    
                    with open(package_json_path, 'w', encoding='utf-8') as f:
                        json.dump(package_json, f, indent=2)
                    
                    console.print(f"[green]✓ Saved to {dep_type} in package.json[/green]")
            
            # Success output
            console.print(f"\n[bold green]✅ Successfully installed {pack.get('name', pack['id'])} v{pack.get('version', '1.0.0')}[/bold green]")
            
            # Package details panel
            details = Panel(
                f"""[cyan]Name:[/cyan] {pack.get('name', pack['id'])}
[cyan]ID:[/cyan] {pack['id']}
[cyan]Version:[/cyan] {pack.get('version', '1.0.0')}
[cyan]Type:[/cyan] {pack.get('package_type', 'basic')}
[cyan]Files:[/cyan] {len(pack.get('files', {}))}
[cyan]Public:[/cyan] {'✅' if pack.get('is_public', True) else '❌'}
[cyan]WASM:[/cyan] {'✅' if pack.get('wasm_url') else '❌'}
[cyan]Location:[/cyan] {package_dir}""",
                title="📦 Package Details",
                border_style="cyan"
            )
            console.print(details)
            
            # Show install commands from the response
            if data.get('install_info'):
                console.print("\n[bold cyan]🔧 Installation Methods:[/bold cyan]")
                methods_table = Table(show_header=False, box=None)
                methods_table.add_column("Method", style="green")
                methods_table.add_column("Command", style="yellow")
                
                install_info = data['install_info']
                if install_info.get('pack_cli'):
                    methods_table.add_row("Pack CLI:", install_info['pack_cli'])
                if install_info.get('npm'):
                    methods_table.add_row("npm:", install_info['npm'])
                if install_info.get('yarn'):
                    methods_table.add_row("yarn:", install_info['yarn'])
                if install_info.get('direct_url'):
                    methods_table.add_row("Direct URL:", install_info['direct_url'])
                
                console.print(methods_table)
            
        except requests.exceptions.RequestException as e:
            progress.stop()
            console.print(f"\n[red]✗ Network error: {str(e)}[/red]")
            
            if hasattr(e, 'response') and e.response is not None:
                try:
                    # Try to parse error as JSON
                    error_data = e.response.json().get('error', {})
                    console.print(f"[yellow]Error Code: {error_data.get('code', 'Unknown')}[/yellow]")
                    
                    if error_data.get('details', {}).get('suggestions'):
                        console.print("\n[yellow]Suggestions:[/yellow]")
                        for suggestion in error_data['details']['suggestions']:
                            console.print(f"  • {suggestion}")
                            
                    if error_data.get('details', {}).get('recoverySteps'):
                        console.print("\n[yellow]Recovery Steps:[/yellow]")
                        for step in error_data['details']['recoverySteps']:
                            console.print(f"  • {step}")
                except:
                    # If not JSON, show raw response
                    console.print(f"[yellow]Response: {e.response.text[:200]}[/yellow]")

# ============================================================================
# SEARCH COMMAND
# ============================================================================

@cli.command()
@click.argument('query', required=False)
@click.option('--type', '-t', 'package_type', help='Filter by package type (basic, wasm, advanced)')
@click.option('--limit', '-l', default=20, help='Maximum results to show')
@click.option('--json', '-j', 'output_json', is_flag=True, help='Output as JSON')
def search(query, package_type, limit, output_json):
    """Search for packages in the registry
    
    If no query is provided, shows popular packages.
    """
    
    config = load_config()
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        task = progress.add_task("🔍 Searching...", total=None)
        
        try:
            params = {}
            if query:
                params['q'] = query
            if package_type:
                params['type'] = package_type
            if limit:
                params['limit'] = limit
            
            response = requests.get(f"{config['registry']}/api/search", params=params)
            response.raise_for_status()
            
            data = response.json()
            progress.update(task, completed=True)
            
            if output_json:
                console.print(json.dumps(data, indent=2))
                return
            
            if data.get('packs'):
                table = Table(title=f"📦 Search Results" + (f": {query}" if query else ""))
                table.add_column("#", style="dim", width=4)
                table.add_column("Package", style="cyan", no_wrap=False)
                table.add_column("Version", style="green")
                table.add_column("Type", style="magenta")
                table.add_column("WASM", justify="center")
                table.add_column("Description", style="white")
                
                for i, pack in enumerate(data['packs'][:limit], 1):
                    wasm = "✅" if pack.get('has_wasm') or pack.get('wasm_url') else "❌"
                    description = pack.get('description', '')[:50] + '...' if pack.get('description') and len(pack.get('description', '')) > 50 else pack.get('description', '')
                    
                    table.add_row(
                        str(i),
                        pack.get('name', pack['id']),
                        pack.get('version', 'latest'),
                        pack.get('package_type', 'basic'),
                        wasm,
                        description
                    )
                
                console.print(table)
                console.print(f"\n[dim]Showing {min(len(data['packs']), limit)} of {len(data['packs'])} results[/dim]")
            else:
                console.print("[yellow]No packages found.[/yellow]")
                
        except requests.exceptions.RequestException as e:
            progress.stop()
            console.print(f"[red]Search failed: {str(e)}[/red]")

# ============================================================================
# INFO COMMAND - UPDATED TO USE API ENDPOINT
# ============================================================================

@cli.command()
@click.argument('package')
@click.option('--json', '-j', 'output_json', is_flag=True, help='Output as JSON')
def info(package, output_json):
    """Show detailed package information"""
    
    config = load_config()
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        task = progress.add_task(f"📦 Fetching {package} info...", total=None)
        
        try:
            # Use API endpoint instead of HTML page
            response = requests.get(
                f"{config['registry']}/api/get-pack", 
                params={'id': package},
                headers={'Accept': 'application/json'}
            )
            response.raise_for_status()
            
            data = response.json()
            progress.update(task, completed=True)
            
            if output_json:
                console.print(json.dumps(data, indent=2))
                return
            
            if not data.get('success'):
                console.print(f"[red]✗ Failed to get package info: {data.get('error', {}).get('message', 'Unknown error')}[/red]")
                return
            
            pack = data['pack']
            
            # Header
            console.print(f"\n[bold cyan]📦 {pack.get('name', pack['id'])}[/bold cyan]")
            console.print(f"[dim]ID: {pack['id']}[/dim]")
            
            # Metadata table
            meta_table = Table(show_header=False, box=None, padding=(0, 2))
            meta_table.add_column("Property", style="cyan")
            meta_table.add_column("Value", style="white")
            
            meta_table.add_row("Version", pack.get('version', 'latest'))
            meta_table.add_row("Type", pack.get('package_type', 'basic'))
            meta_table.add_row("Public", "✅" if pack.get('is_public', True) else "❌")
            meta_table.add_row("Files", str(len(pack.get('files', {}))))
            meta_table.add_row("WASM", "✅" if pack.get('wasm_url') else "❌")
            meta_table.add_row("Created", pack.get('created_at', 'Unknown')[:10] if pack.get('created_at') else 'Unknown')
            
            console.print(Panel(meta_table, title="Package Info", border_style="cyan"))
            
            # Description from pack_json
            if pack.get('pack_json') and pack['pack_json'].get('description'):
                console.print("\n[cyan]Description:[/cyan]")
                console.print(f"  {pack['pack_json']['description']}")
            
            # Links
            console.print("\n[cyan]🔗 Links:[/cyan]")
            console.print(f"  CDN: {config['registry']}/cdn/{pack['url_id']}")
            console.print(f"  Info: {config['registry']}/pack/{pack['url_id']}")
            if pack.get('wasm_url'):
                console.print(f"  WASM: {config['registry']}/wasm/{pack['url_id']}")
            
            # Files tree
            if pack.get('files'):
                console.print("\n[cyan]📁 Files:[/cyan]")
                tree = Tree("📦 Package Root")
                
                # Group files by directory
                files_by_dir = {}
                for filename in pack['files'].keys():
                    parts = filename.split('/')
                    if len(parts) > 1:
                        dir_name = parts[0]
                        if dir_name not in files_by_dir:
                            files_by_dir[dir_name] = []
                        files_by_dir[dir_name].append('/'.join(parts[1:]))
                    else:
                        files_by_dir['.'] = files_by_dir.get('.', []) + [filename]
                
                for dir_name, files in files_by_dir.items():
                    if dir_name == '.':
                        for file in files[:5]:
                            tree.add(f"📄 {file}")
                        if len(files) > 5:
                            tree.add(f"... and {len(files) - 5} more files")
                    else:
                        branch = tree.add(f"📁 {dir_name}/")
                        for file in files[:3]:
                            branch.add(f"📄 {file}")
                        if len(files) > 3:
                            branch.add(f"... and {len(files) - 3} more files")
                
                console.print(tree)
            
        except requests.exceptions.RequestException as e:
            progress.stop()
            console.print(f"[red]Error: {str(e)}[/red]")

# ============================================================================
# LIST COMMAND
# ============================================================================

@cli.command(name='list')
@click.option('--global', '-g', 'global_list', is_flag=True, help='List globally installed packages')
def list_packages(global_list):
    """List installed packages"""
    
    config = load_config()
    
    if global_list:
        install_dir = Path(config.get('global_install_path'))
    else:
        install_dir = INSTALL_DIR
    
    if not install_dir.exists():
        console.print("[yellow]No packages installed.[/yellow]")
        if not global_list:
            console.print("\n[dim]Install a package with: pack install <package>[/dim]")
        return
    
    packages = list(install_dir.glob('*'))
    
    if not packages:
        console.print("[yellow]No packages installed.[/yellow]")
        return
    
    table = Table(title=f"📦 Installed Packages {'(Global)' if global_list else '(Local)'}")
    table.add_column("Package", style="cyan")
    table.add_column("Version", style="green")
    table.add_column("Type", style="magenta")
    table.add_column("Size", style="yellow")
    table.add_column("Location", style="dim")
    
    total_size = 0
    
    for package_dir in packages:
        manifest_file = package_dir / 'pack-info.json'
        if manifest_file.exists():
            with open(manifest_file, encoding='utf-8') as f:
                pack = json.load(f)
                
                # Calculate size
                size = 0
                for file in package_dir.rglob('*'):
                    if file.is_file() and file.name != 'pack-info.json':
                        size += file.stat().st_size
                total_size += size
                
                table.add_row(
                    pack.get('name', pack['id']),
                    pack.get('version', '1.0.0'),
                    pack.get('package_type', 'basic'),
                    f"{size / 1024:.1f} KB" if size < 1024*1024 else f"{size / (1024*1024):.1f} MB",
                    str(package_dir)[:40] + "..."
                )
    
    console.print(table)
    console.print(f"\n[dim]Total: {len(packages)} packages, {total_size / (1024*1024):.1f} MB[/dim]")

# ============================================================================
# UNINSTALL COMMAND
# ============================================================================

@cli.command()
@click.argument('package')
@click.option('--global', '-g', 'global_uninstall', is_flag=True, help='Uninstall globally')
@click.option('--yes', '-y', is_flag=True, help='Skip confirmation')
def uninstall(package, global_uninstall, yes):
    """Uninstall a package"""
    
    config = load_config()
    
    if global_uninstall:
        install_dir = Path(config.get('global_install_path'))
    else:
        install_dir = INSTALL_DIR
    
    package_dir = install_dir / package
    
    if not package_dir.exists():
        console.print(f"[red]Package {package} not found in {'global' if global_uninstall else 'local'} installation[/red]")
        return
    
    # Confirm
    if not yes:
        if not Confirm.ask(f"Are you sure you want to uninstall {package}?"):
            console.print("[yellow]Uninstall cancelled.[/yellow]")
            return
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        task = progress.add_task(f"🗑️ Uninstalling {package}...", total=None)
        
        try:
            shutil.rmtree(package_dir)
            progress.update(task, completed=True)
            console.print(f"[green]✓ Successfully uninstalled {package}[/green]")
        except Exception as e:
            progress.stop()
            console.print(f"[red]✗ Failed to uninstall: {str(e)}[/red]")

# ============================================================================
# PUBLISH COMMAND
# ============================================================================

@cli.command()
@click.argument('path', default='.', type=click.Path(exists=True))
@click.option('--key', '-k', help='API key for authentication')
@click.option('--public/--private', default=True, help='Package visibility')
@click.option('--type', '-t', 'package_type', help='Package type (basic, wasm, advanced)')
def publish(path, key, public, package_type):
    """Publish a package to the registry"""
    
    config = load_config()
    api_key = key or config.get('api_key')
    
    if not api_key:
        console.print("[red]✗ API key required. Set with: pack config set api_key YOUR_KEY[/red]")
        return
    
    path = Path(path)
    
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        
        # Task 1: Validate package
        task1 = progress.add_task("📋 Validating package...", total=None)
        
        # Check for package.json
        package_json_path = path / 'package.json'
        if not package_json_path.exists():
            progress.stop()
            console.print("[red]✗ package.json not found[/red]")
            return
        
        with open(package_json_path, encoding='utf-8') as f:
            package_json = json.load(f)
        
        if not package_json.get('name'):
            progress.stop()
            console.print("[red]✗ package.json missing 'name' field[/red]")
            return
        
        if not package_json.get('version'):
            progress.stop()
            console.print("[red]✗ package.json missing 'version' field[/red]")
            return
        
        progress.update(task1, completed=True)
        
        # Task 2: Create archive
        task2 = progress.add_task("📦 Creating package archive...", total=None)
        
        import tempfile
        
        with tempfile.NamedTemporaryFile(suffix='.tar.gz', delete=False) as tmp:
            archive_path = tmp.name
        
        try:
            # Create tar.gz archive
            with tarfile.open(archive_path, 'w:gz') as tar:
                for file_path in path.rglob('*'):
                    if file_path.is_file() and not any(part.startswith('.') for part in file_path.parts):
                        arcname = file_path.relative_to(path)
                        tar.add(file_path, arcname=arcname)
            
            progress.update(task2, completed=True)
            
            # Task 3: Upload
            task3 = progress.add_task("📤 Uploading to registry...", total=None)
            
            with open(archive_path, 'rb') as f:
                files = {'package': (f'{package_json["name"]}.tar.gz', f, 'application/gzip')}
                data = {
                    'name': package_json['name'],
                    'version': package_json['version'],
                    'description': package_json.get('description', ''),
                    'public': str(public).lower(),
                    'type': package_type or package_json.get('type', 'basic')
                }
                
                response = requests.post(
                    f"{config['registry']}/api/publish",
                    files=files,
                    data=data,
                    headers={'Authorization': f'Bearer {api_key}'}
                )
            
            progress.update(task3, completed=True)
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    console.print(f"\n[bold green]✅ Successfully published {package_json['name']} v{package_json['version']}[/bold green]")
                    console.print(f"\n[cyan]Package URL:[/cyan] {config['registry']}/pack/{result.get('id')}")
                else:
                    console.print(f"[red]✗ Publish failed: {result.get('error', 'Unknown error')}[/red]")
            else:
                console.print(f"[red]✗ Publish failed: HTTP {response.status_code}[/red]")
                try:
                    error = response.json()
                    console.print(f"[yellow]Error: {error.get('error', {}).get('message', 'Unknown')}[/yellow]")
                except:
                    pass
        
        finally:
            # Cleanup
            if os.path.exists(archive_path):
                os.unlink(archive_path)

# ============================================================================
# CONFIG COMMAND
# ============================================================================

@cli.group()
def config():
    """Manage configuration"""
    pass

@config.command('set')
@click.argument('key')
@click.argument('value')
def config_set(key, value):
    """Set a configuration value"""
    config = load_config()
    
    # Parse value type
    if value.lower() in ('true', 'false'):
        value = value.lower() == 'true'
    elif value.isdigit():
        value = int(value)
    
    config[key] = value
    save_config(config)
    console.print(f"[green]✓ Set {key} = {value}[/green]")

@config.command('get')
@click.argument('key', required=False)
def config_get(key):
    """Get configuration value(s)"""
    config = load_config()
    
    if key:
        if key in config:
            console.print(f"{key}: {config[key]}")
        else:
            console.print(f"[red]Key '{key}' not found[/red]")
    else:
        table = Table(title="Configuration")
        table.add_column("Key", style="cyan")
        table.add_column("Value", style="green")
        
        for k, v in config.items():
            table.add_row(k, str(v))
        
        console.print(table)

@config.command('list')
def config_list():
    """List all configuration"""
    config_get()

# ============================================================================
# CACHE COMMAND
# ============================================================================

@cli.group()
def cache():
    """Manage cache"""
    pass

@cache.command('clear')
def cache_clear():
    """Clear the cache"""
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console
    ) as progress:
        task = progress.add_task("🧹 Clearing cache...", total=None)
        
        count = 0
        for cache_file in CACHE_DIR.glob('*'):
            cache_file.unlink()
            count += 1
        
        progress.update(task, completed=True)
        console.print(f"[green]✓ Cleared {count} cache entries[/green]")

@cache.command('info')
def cache_info():
    """Show cache information"""
    cache_files = list(CACHE_DIR.glob('*'))
    
    if not cache_files:
        console.print("[yellow]Cache is empty[/yellow]")
        return
    
    total_size = sum(f.stat().st_size for f in cache_files)
    
    table = Table(title="Cache Information")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")
    
    table.add_row("Entries", str(len(cache_files)))
    table.add_row("Total Size", f"{total_size / 1024:.1f} KB" if total_size < 1024*1024 else f"{total_size / (1024*1024):.1f} MB")
    table.add_row("Location", str(CACHE_DIR))
    
    console.print(table)

# ============================================================================
# VERSION COMMAND
# ============================================================================

@cli.command()
def version():
    """Show version information"""
    console.print(Panel.fit(
        "[bold cyan]PackCDN CLI[/bold cyan] v1.0.0\n"
        f"[dim]Registry: {PACKCDN_URL}[/dim]\n"
        f"[dim]Python: {sys.version.split()[0]}[/dim]",
        title="📦 Pack Package Manager"
    ))

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

if __name__ == '__main__':
    try:
        cli()
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted by user[/yellow]")
        sys.exit(1)
    except Exception as e:
        console.print(f"\n[red]Unexpected error: {str(e)}[/red]")
        if '--debug' in sys.argv:
            import traceback
            console.print(traceback.format_exc())
        sys.exit(1)
