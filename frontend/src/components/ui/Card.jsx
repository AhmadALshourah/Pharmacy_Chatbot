export default function Card({ title, sub, action, children, padded = true, style }) {
  return (
    <div className="pc-card" style={style}>
      {(title || action) && (
        <div className="pc-card-head">
          <div>
            {title && <div className="pc-card-title">{title}</div>}
            {sub && <div className="pc-card-sub" style={{ marginTop: 2 }}>{sub}</div>}
          </div>
          {action}
        </div>
      )}
      {/* L9: when padded=false no class is applied so no padding exists — the
          redundant inline style={{padding:0}} was removed */}
      <div className={padded ? 'pc-card-body' : ''}>
        {children}
      </div>
    </div>
  );
}
