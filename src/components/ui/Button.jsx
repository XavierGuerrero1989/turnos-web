export default function Button({ as="button", variant="primary", className="", ...props }){
  const Comp = as;
  const base = "btn " + (variant==="primary" ? "btn-primary" : "btn-outline");
  return <Comp className={`${base} ${className}`} {...props} />;
}
