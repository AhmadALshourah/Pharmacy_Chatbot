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
      <div className={padded ? 'pc-card-body' : ''} style={!padded ? { padding: 0 } : undefined}>
        {children}
      </div>
    </div>
  );
}
