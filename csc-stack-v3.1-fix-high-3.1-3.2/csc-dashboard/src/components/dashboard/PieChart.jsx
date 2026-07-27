/**
 * Pie chart SVG sederhana, tanpa dependency library chart eksternal
 *
 * @param {{ slices: { label: string, value: number, color: string }[] }} props
 */
export default function PieChart({ slices }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        Belum ada data untuk ditampilkan.
      </div>
    );
  }

  const radius = 80;
  const center = 90;
  let cumulativeAngle = -90; // mulai dari jam 12

  function polarPoint(angleDeg) {
    const angleRad = (Math.PI / 180) * angleDeg;
    return {
      x: center + radius * Math.cos(angleRad),
      y: center + radius * Math.sin(angleRad),
    };
  }

  const paths = slices
    .filter((slice) => slice.value > 0)
    .map((slice) => {
      const angle = (slice.value / total) * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle = endAngle;

      if (angle >= 359.99) {
        const p1 = polarPoint(startAngle);
        const p2 = polarPoint(startAngle + 180);
        return {
          ...slice,
          d: `M${p1.x},${p1.y} A${radius},${radius} 0 1 1 ${p2.x},${p2.y} A${radius},${radius} 0 1 1 ${p1.x},${p1.y} Z`,
        };
      }

      const start = polarPoint(startAngle);
      const end = polarPoint(endAngle);
      const largeArcFlag = angle > 180 ? 1 : 0;
      return {
        ...slice,
        d: `M${center},${center} L${start.x},${start.y} A${radius},${radius} 0 ${largeArcFlag} 1 ${end.x},${end.y} Z`,
      };
    });

  return (
    <div className="flex flex-wrap items-center gap-8">
      <svg width={180} height={180} viewBox="0 0 180 180" role="img" aria-label="Pie chart status pengiriman">
        {paths.map((slice) => (
          <path key={slice.label} d={slice.d} fill={slice.color} stroke="#fff" strokeWidth={1.5} />
        ))}
      </svg>

      <ul className="flex flex-col gap-2 text-sm">
        {slices.map((slice) => {
          const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
          return (
            <li key={slice.label} className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
                aria-hidden="true"
              />
              <span className="text-gray-700">{slice.label}</span>
              <span className="text-gray-400">
                {slice.value} ({pct}%)
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
