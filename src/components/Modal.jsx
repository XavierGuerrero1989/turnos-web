export default function Modal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,.4)",
      display:"flex", alignItems:"center", justifyContent:"center"
    }}>
      <div style={{ background:"#fff", padding:24, borderRadius:8, minWidth:320 }}>
        <button onClick={onClose} style={{ float:"right" }}>×</button>
        {children}
      </div>
    </div>
  );
}
