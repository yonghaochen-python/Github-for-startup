import { LiquidGlass } from "@/components/LiquidGlass";

/** The branded loading screen: the satin mirror behind the Virm wordmark. */
export function LoadingScreen() {
  return (
    <main
      aria-label="Loading Virm"
      className="fixed inset-0 z-[100] isolate flex flex-col items-center justify-center overflow-hidden text-[#121821]"
    >
      <LiquidGlass className="absolute inset-0 -z-10" />
      <div className="font-display relative font-normal" style={{ fontSize: "clamp(56px, 7vw, 96px)", letterSpacing: "-2px" }}>
        Vir<em className="font-normal">m</em>
      </div>
      <div className="relative mt-8 h-px w-[150px] overflow-hidden bg-[#121821]/15">
        <span className="loading-bar-fill block h-full w-[42%] bg-[#121821]/70" />
      </div>
      <p className="relative mt-3.5 text-[10px] font-medium uppercase tracking-[2.4px] text-[#2f3b47]">Preparing your wardrobe</p>
    </main>
  );
}
