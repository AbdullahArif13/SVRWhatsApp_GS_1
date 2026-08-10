export default function Watermark() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
    >
      <img
        src="/gs-watermark.png"
        alt=""
        className="h-[540px] w-[540px] select-none object-contain"
      />
    </div>
  );
}
