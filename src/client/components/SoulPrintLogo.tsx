const LOGO_SRC = '/images/soulprintsvglogo.svg';

interface SoulPrintLogoProps {
  size?: number;
  className?: string;
}

export function SoulPrintLogo({ size = 48, className }: SoulPrintLogoProps) {
  return (
    <img
      src={LOGO_SRC}
      alt="SoulPrint"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block' }}
    />
  );
}

interface SoulPrintWordmarkProps {
  size?: number;
  className?: string;
}

export function SoulPrintWordmark({ size = 48, className }: SoulPrintWordmarkProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: size * 0.25,
      }}
    >
      <SoulPrintLogo size={size} />
      <span
        style={{
          fontFamily: "'Geist', sans-serif",
          fontSize: size * 0.5,
          fontWeight: 600,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          lineHeight: 1,
        }}
      >
        <span style={{ color: '#fff' }}>SOUL</span>
        <span style={{ color: '#EA580C' }}>PRINT</span>
      </span>
    </div>
  );
}
