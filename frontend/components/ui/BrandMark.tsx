type BrandMarkProps = {
  size?: number;
  className?: string;
};

export function BrandMark({ size = 32, className = "" }: BrandMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="4.5"
        y="5.5"
        width="13"
        height="17"
        rx="2"
        className="brand-mark-doc-back"
        strokeWidth="1.15"
      />
      <rect
        x="10.5"
        y="9.5"
        width="13"
        height="17"
        rx="2"
        className="brand-mark-doc-front"
        strokeWidth="1.15"
      />
      <path d="M19.5 9.5h4.5v4.5" className="brand-mark-fold" strokeWidth="1.1" strokeLinecap="round" />
      <path
        d="M13.5 22.5h5.5"
        className="brand-mark-link"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
      <rect
        x="20.75"
        y="19.75"
        width="6.5"
        height="6.5"
        rx="1.5"
        className="brand-mark-cite"
        strokeWidth="1.1"
      />
      <text
        x="24"
        y="24.25"
        textAnchor="middle"
        fontSize="4.25"
        fontWeight="700"
        className="brand-mark-cite-num"
        fontFamily="var(--font-geist-mono), ui-monospace, monospace"
      >
        1
      </text>
    </svg>
  );
}
