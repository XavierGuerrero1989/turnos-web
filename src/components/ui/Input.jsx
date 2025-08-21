export default function Input({ label, id, className="", ...props }){
  return (
    <div className="stack">
      {label && <label className="label" htmlFor={id}>{label}</label>}
      <input id={id} className={`input ${className}`} {...props}/>
    </div>
  );
}
