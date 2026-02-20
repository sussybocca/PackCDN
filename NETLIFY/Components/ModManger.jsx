'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import _ from 'lodash';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function ModManager({ addNotification, onModDragStart }) {
  const [mods, setMods] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [worldName, setWorldName] = useState('My Awesome World');
  const [draggingModId, setDraggingModId] = useState(null);

  useEffect(() => {
    fetchMods();
  }, []);

  const fetchMods = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('mods')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setMods(data || []);
      addNotification(`Loaded ${data?.length || 0} mods`, 'info');
    } catch (error) {
      console.error('Error fetching mods:', error);
      addNotification('Failed to load mods', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addNotification]);

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    let completed = 0;
    
    for (const file of files) {
      try {
        setUploadProgress((completed / files.length) * 100);
        
        const reader = new FileReader();
        reader.onload = async (e) => {
          const mod = {
            id: uuidv4(),
            name: file.name,
            type: getFileType(file.name),
            size: file.size,
            data: e.target.result,
            metadata: {
              uploaded_by: 'user',
              version: '1.0.0',
              dependencies: detectDependencies(file.name, e.target.result),
              category: detectCategory(file.name),
              icon: getModIcon(file.name),
              color: getModColor(file.name),
              script: extractScriptContent(e.target.result, file.name)
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          const { error } = await supabase
            .from('mods')
            .insert([mod]);

          if (error) throw error;

          completed++;
          setUploadProgress((completed / files.length) * 100);
          
          if (completed === files.length) {
            addNotification(`Uploaded ${files.length} mod(s)`, 'success');
            fetchMods();
            setUploadProgress(0);
          }
        };
        
        if (file.type.startsWith('image/')) {
          reader.readAsDataURL(file);
        } else if (file.type === 'application/json') {
          reader.readAsText(file);
        } else {
          reader.readAsText(file, 'UTF-8');
        }
      } catch (error) {
        console.error('Upload error:', error);
        addNotification(`Failed to upload ${file.name}`, 'error');
      }
    }
  };

  const getFileType = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) return 'javascript';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (['glb', 'gltf', 'fbx', 'obj'].includes(ext)) return '3d-model';
    if (['json', 'yml', 'yaml'].includes(ext)) return 'config';
    if (['css', 'scss', 'less'].includes(ext)) return 'style';
    if (['html', 'htm'].includes(ext)) return 'html';
    return 'other';
  };

  const detectCategory = (filename) => {
    const name = filename.toLowerCase();
    if (name.includes('character') || name.includes('player')) return 'character';
    if (name.includes('vehicle') || name.includes('car')) return 'vehicle';
    if (name.includes('building') || name.includes('house')) return 'building';
    if (name.includes('tree') || name.includes('plant')) return 'nature';
    if (name.includes('weapon') || name.includes('gun')) return 'weapon';
    if (name.includes('effect') || name.includes('particle')) return 'effect';
    if (name.includes('ui') || name.includes('interface')) return 'ui';
    if (name.includes('ai') || name.includes('bot')) return 'ai';
    return 'object';
  };

  const getModIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) return 'fa-code';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'fa-image';
    if (['glb', 'gltf', 'fbx', 'obj'].includes(ext)) return 'fa-cube';
    if (['json', 'yml', 'yaml'].includes(ext)) return 'fa-cogs';
    if (['css', 'scss', 'less'].includes(ext)) return 'fa-paint-brush';
    if (['html', 'htm'].includes(ext)) return 'fa-code';
    return 'fa-file';
  };

  const getModColor = (filename) => {
    const category = detectCategory(filename);
    const colors = {
      'character': '#ff6b6b',
      'vehicle': '#4ecdc4',
      'building': '#45b7d1',
      'nature': '#96ceb4',
      'weapon': '#feca57',
      'effect': '#ff9ff3',
      'ui': '#54a0ff',
      'ai': '#5f27cd',
      'object': '#8395a7',
      'default': '#6c5ce7'
    };
    return colors[category] || colors['default'];
  };

  const extractScriptContent = (content, filename) => {
    if (typeof content !== 'string') return '';
    
    const ext = filename.split('.').pop().toLowerCase();
    if (!['js', 'ts', 'jsx', 'tsx'].includes(ext)) return '';
    
    // Extract class names, function names for display
    const classMatches = content.match(/class\s+(\w+)/g) || [];
    const functionMatches = content.match(/function\s+(\w+)/g) || [];
    const constMatches = content.match(/const\s+(\w+)\s*=/g) || [];
    
    const allNames = [...classMatches, ...functionMatches, ...constMatches]
      .map(name => name.replace(/class\s+|function\s+|const\s+|=\s*$/, ''))
      .filter(name => name.length > 0);
    
    return {
      content: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
      preview: content.substring(0, 200),
      identifiers: allNames,
      lines: content.split('\n').length
    };
  };

  const detectDependencies = (filename, content) => {
    const deps = [];
    const contentStr = typeof content === 'string' ? content : '';
    
    if (contentStr.includes('THREE') || contentStr.includes('three')) deps.push('three');
    if (contentStr.includes('CANNON') || contentStr.includes('cannon')) deps.push('cannon-es');
    if (contentStr.includes('gsap')) deps.push('gsap');
    if (contentStr.includes('import ') || contentStr.includes('require(')) {
      const importRegex = /from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\)/g;
      let match;
      while ((match = importRegex.exec(contentStr)) !== null) {
        const dep = match[1] || match[2];
        if (dep && !dep.startsWith('.')) deps.push(dep);
      }
    }
    
    return _.uniq(deps);
  };

  const deleteMod = async (id) => {
    if (!confirm('Delete this mod?')) return;
    
    try {
      const { error } = await supabase
        .from('mods')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setMods(prev => prev.filter(mod => mod.id !== id));
      addNotification('Mod deleted', 'success');
    } catch (error) {
      console.error('Delete error:', error);
      addNotification('Failed to delete mod', 'error');
    }
  };

  const exportWorld = async () => {
    try {
      const zip = new JSZip();
      
      // Add world configuration
      const worldConfig = {
        name: worldName,
        version: '3.0',
        created: new Date().toISOString(),
        mods: mods.map(mod => ({
          id: mod.id,
          name: mod.name,
          type: mod.type,
          metadata: mod.metadata
        }))
      };
      
      zip.file('world.json', JSON.stringify(worldConfig, null, 2));
      
      // Add each mod
      for (const mod of mods) {
        if (mod.type === 'javascript') {
          zip.file(`mods/${mod.name}`, mod.data);
        } else if (mod.type === 'image') {
          const base64Data = mod.data.split(',')[1];
          zip.file(`assets/${mod.name}`, base64Data, { base64: true });
        } else if (mod.type === '3d-model') {
          zip.file(`models/${mod.name}`, mod.data);
        }
      }
      
      // Generate zip file
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${worldName.replace(/\s+/g, '_')}.modz3`);
      
      addNotification('World exported successfully!', 'success');
    } catch (error) {
      console.error('Export error:', error);
      addNotification('Failed to export world', 'error');
    }
  };

  const importWorld = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const zip = new JSZip();
      const zipData = await zip.loadAsync(file);
      
      // Read world config
      const configFile = zipData.file('world.json');
      if (!configFile) throw new Error('Invalid world file');
      
      const config = JSON.parse(await configFile.async('text'));
      setWorldName(config.name);
      
      // Import mods
      const modPromises = [];
      
      for (const modRef of config.mods) {
        let modFile = zipData.file(`mods/${modRef.name}`);
        if (!modFile) modFile = zipData.file(`assets/${modRef.name}`);
        if (!modFile) modFile = zipData.file(`models/${modRef.name}`);
        
        if (modFile) {
          let data;
          if (modRef.type === 'image') {
            data = `data:image/${modRef.name.split('.').pop()};base64,${await modFile.async('base64')}`;
          } else {
            data = await modFile.async('text');
          }
          
          const mod = {
            ...modRef,
            id: uuidv4(),
            data,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          modPromises.push(
            supabase.from('mods').insert([mod])
          );
        }
      }
      
      await Promise.all(modPromises);
      await fetchMods();
      
      addNotification(`Imported world: ${config.name}`, 'success');
    } catch (error) {
      console.error('Import error:', error);
      addNotification('Failed to import world', 'error');
    }
  };

  // Drag handlers for mods
  const handleModDragStart = (e, mod) => {
    e.dataTransfer.setData('application/mod-data', JSON.stringify(mod));
    e.dataTransfer.effectAllowed = 'copy';
    
    setDraggingModId(mod.id);
    if (onModDragStart) {
      onModDragStart(mod);
    }
    
    // Add visual feedback
    e.target.classList.add('dragging');
  };

  const handleModDragEnd = (e) => {
    setDraggingModId(null);
    e.target.classList.remove('dragging');
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Execute mod in 3D world
  const executeModInWorld = (mod) => {
    if (mod.type === 'javascript') {
      window.dispatchEvent(new CustomEvent('execute-mod-script', {
        detail: {
          mod: mod,
          script: mod.data,
          position: { x: 0, y: 0, z: 0 }
        }
      }));
      addNotification(`Executing mod: ${mod.name}`, 'info');
    } else if (mod.type === '3d-model') {
      window.dispatchEvent(new CustomEvent('add-3d-model', {
        detail: {
          mod: mod,
          modelData: mod.data,
          position: { x: 0, y: 5, z: 0 }
        }
      }));
      addNotification(`Loading 3D model: ${mod.name}`, 'info');
    } else if (mod.type === 'image') {
      window.dispatchEvent(new CustomEvent('add-texture', {
        detail: {
          mod: mod,
          textureData: mod.data,
          position: { x: 0, y: 2, z: 0 }
        }
      }));
      addNotification(`Adding texture: ${mod.name}`, 'info');
    }
  };

  if (isLoading) {
    return (
      <div className="sidebar-loading">
        <div className="loading-spinner"></div>
        <p>Loading mods...</p>
      </div>
    );
  }

  return (
    <div className="mod-manager">
      <div className="sidebar-section">
        <h3 className="sidebar-title">
          <i className="fas fa-cloud-upload-alt"></i>
          <span>Upload Advanced Mods</span>
        </h3>
        
        <div 
          className="upload-area"
          onClick={() => document.getElementById('fileInput').click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add('drag-over');
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove('drag-over');
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
              const input = document.getElementById('fileInput');
              const dataTransfer = new DataTransfer();
              for (let i = 0; i < files.length; i++) {
                dataTransfer.items.add(files[i]);
              }
              input.files = dataTransfer.files;
              const event = new Event('change', { bubbles: true });
              input.dispatchEvent(event);
            }
          }}
        >
          <i className="fas fa-file-upload upload-icon"></i>
          <div className="upload-text">Drag & Drop Files Here</div>
          <div className="upload-subtext">
            Supports: .js, .jsx, .ts, .glb, .png, .json
            <br/>
            Node.js packages allowed
          </div>
          
          {uploadProgress > 0 && (
            <div className="upload-progress">
              <div 
                className="upload-progress-bar" 
                style={{ width: `${uploadProgress}%` }}
              ></div>
            </div>
          )}
        </div>
        
        <input
          id="fileInput"
          type="file"
          multiple
          accept=".js,.jsx,.ts,.tsx,.glb,.gltf,.fbx,.obj,.png,.jpg,.jpeg,.gif,.webp,.svg,.json,.yml,.yaml,.css,.scss,.less,.html,.htm"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </div>

      <div className="sidebar-section">
        <h3 className="sidebar-title">
          <i className="fas fa-box-open"></i>
          <span>Your Mods ({mods.length})</span>
        </h3>
        
        {mods.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-cloud-upload-alt"></i>
            <p>Upload mods to get started</p>
            <p className="empty-hint">Drag mods into the 3D world!</p>
          </div>
        ) : (
          <div className="mod-list">
            {mods.map((mod) => (
              <div 
                key={mod.id} 
                className={`mod-item ${draggingModId === mod.id ? 'dragging' : ''}`}
                draggable="true"
                onDragStart={(e) => handleModDragStart(e, mod)}
                onDragEnd={handleModDragEnd}
                onClick={() => executeModInWorld(mod)}
                title="Click to execute in world or drag into 3D world"
              >
                <div 
                  className={`mod-icon ${mod.type}`}
                  style={{ backgroundColor: mod.metadata?.color || '#6c5ce7' }}
                >
                  <i className={`fas ${mod.metadata?.icon || 'fa-file'}`}></i>
                </div>
                
                <div className="mod-info">
                  <h4>{mod.name}</h4>
                  <p className="mod-type">
                    <span className={`mod-category ${mod.metadata?.category || 'object'}`}>
                      {mod.metadata?.category || 'object'}
                    </span>
                    <span className="mod-size">{formatFileSize(mod.size)}</span>
                  </p>
                  {mod.metadata?.dependencies?.length > 0 && (
                    <div className="mod-deps">
                      <i className="fas fa-code-branch"></i>
                      <span>{mod.metadata.dependencies.length} dependencies</span>
                    </div>
                  )}
                  {mod.type === 'javascript' && mod.metadata?.script?.identifiers?.length > 0 && (
                    <div className="mod-script-info">
                      <i className="fas fa-terminal"></i>
                      <span>{mod.metadata.script.identifiers.slice(0, 3).join(', ')}</span>
                    </div>
                  )}
                  <small className="mod-date">
                    {format(new Date(mod.created_at), 'MMM d, yyyy')}
                  </small>
                </div>
                
                <div className="mod-actions">
                  <button 
                    className="mod-action-btn play"
                    onClick={(e) => {
                      e.stopPropagation();
                      executeModInWorld(mod);
                    }}
                    title="Execute in world"
                  >
                    <i className="fas fa-play"></i>
                  </button>
                  <button 
                    className="mod-action-btn edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      addNotification('Edit feature coming soon', 'info');
                    }}
                    title="Edit mod"
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button 
                    className="mod-action-btn delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMod(mod.id);
                    }}
                    title="Delete mod"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <h3 className="sidebar-title">
          <i className="fas fa-database"></i>
          <span>World Management</span>
        </h3>
        
        <div className="world-actions">
          <button 
            className="btn btn-secondary btn-block"
            onClick={() => document.getElementById('worldImport').click()}
          >
            <i className="fas fa-folder-open"></i> Import World
          </button>
          
          <button 
            className="btn btn-primary btn-block"
            onClick={exportWorld}
          >
            <i className="fas fa-download"></i> Export World
          </button>
          
          <button 
            className="btn btn-accent btn-block"
            onClick={() => window.dispatchEvent(new CustomEvent('clear-world'))}
          >
            <i className="fas fa-trash"></i> Clear World
          </button>
          
          <input
            id="worldImport"
            type="file"
            accept=".modz3,.zip"
            onChange={importWorld}
            style={{ display: 'none' }}
          />
        </div>
        
        <div className="world-info">
          <div className="world-name">
            <input
              type="text"
              value={worldName}
              onChange={(e) => setWorldName(e.target.value)}
              className="world-name-input"
              placeholder="World name"
            />
          </div>
          
          <div className="world-stats">
            <div className="stat">
              <i className="fas fa-cube"></i>
              <span>{mods.length} Mods</span>
            </div>
            <div className="stat">
              <i className="fas fa-code-branch"></i>
              <span>
                {_.uniq(mods.flatMap(m => m.metadata?.dependencies || [])).length} Packages
              </span>
            </div>
            <div className="stat">
              <i className="fas fa-memory"></i>
              <span>
                {formatFileSize(mods.reduce((sum, mod) => sum + mod.size, 0))}
              </span>
            </div>
          </div>
        </div>

        <div className="drag-instructions">
          <div className="instruction">
            <i className="fas fa-mouse-pointer"></i>
            <span>Click mod to execute</span>
          </div>
          <div className="instruction">
            <i className="fas fa-arrows-alt"></i>
            <span>Drag mod into 3D world</span>
          </div>
        </div>
      </div>
    </div>
  );
}
