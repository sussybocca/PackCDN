// pages/index.jsx
import ModManager from '@/Components/ModManager';

export default function Home() {
  // Dummy notification handler (replace with your actual implementation)
  const addNotification = (message, type) => {
    console.log(`[${type}] ${message}`);
  };

  const handleModDragStart = (mod) => {
    console.log('Drag started:', mod);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>3D Mod Manager</h1>
      <ModManager 
        addNotification={addNotification} 
        onModDragStart={handleModDragStart} 
      />
    </div>
  );
}
