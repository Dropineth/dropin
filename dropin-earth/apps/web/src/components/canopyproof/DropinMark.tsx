type DropinMarkProps = {
  className?: string;
  label?: string;
  size?: number;
};

export function DropinMark({ className = "", label, size = 48 }: DropinMarkProps) {
  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={`cp-mark ${className}`}
      height={size}
      role={label ? "img" : undefined}
      viewBox="0 0 128 128"
      width={size}
    >
      <defs>
        <linearGradient id="cpMarkOcean" x1="11" x2="107" y1="29" y2="113" gradientUnits="userSpaceOnUse">
          <stop stopColor="#24D6C3" />
          <stop offset="0.52" stopColor="#39DDF2" />
          <stop offset="1" stopColor="#0B3554" />
        </linearGradient>
        <linearGradient id="cpMarkLeaf" x1="23" x2="87" y1="93" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6EE787" />
          <stop offset="1" stopColor="#24D6C3" />
        </linearGradient>
      </defs>
      <circle cx="64" cy="64" r="58" fill="#04111F" opacity="0.96" />
      <path
        d="M112 66.5C107.2 96.5 84.8 118 58.3 118C30.4 118 9 97.1 9 70.1c0-12 4.7-24.2 13.3-34.6C15.7 49 18.6 65.1 30.4 76.7c18.5 18.2 53.3 12.9 77.8-11.8 1.3-1.3 2.5-2.6 3.8-4z"
        fill="url(#cpMarkOcean)"
      />
      <path
        d="M18.5 82.5C33.2 95.8 60 94 82.3 77.2c12.4-9.4 21.1-21.2 25-33.2C102.1 70.2 76.9 98.6 45.1 101.8c-10.7 1.1-19.8-1.3-26.6-6.2z"
        fill="#B9F8D3"
        opacity="0.42"
      />
      <path
        d="M24 86c34.7-2.4 55.1-18.4 74.3-49.7C93.3 64.9 74.9 86.9 51.1 93.1 40.1 96 30.7 93.8 24 86z"
        fill="url(#cpMarkLeaf)"
      />
      <circle cx="66.5" cy="33.5" r="12.5" fill="#2B7082" />
      <circle cx="66.5" cy="33.5" r="6.2" fill="#39DDF2" opacity="0.22" />
    </svg>
  );
}
