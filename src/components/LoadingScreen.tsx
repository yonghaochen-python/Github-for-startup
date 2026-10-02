/** The branded loading screen — "Melt": drifting, merging liquid-chrome blobs behind the wordmark. */
export function LoadingScreen() {
  return (
    <main
      aria-label="Loading Virtual Mirror"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden text-[#f9fbfb]"
      style={{ background: "radial-gradient(circle at 50% 55%, #1a1e21 0%, #0a0d0f 75%)" }}
    >
      <div className="lava-group absolute left-1/2 top-1/2 aspect-square" style={{ width: "58%" }}>
        <span
          className="lava-blob lava-blob-1 absolute rounded-full"
          style={{
            width: "60%",
            height: "60%",
            top: 0,
            left: "10%",
            background:
              "radial-gradient(circle at 38% 32%, #fff 0%, #d7dde0 22%, #7a858b 55%, #202427 85%)",
          }}
        />
        <span
          className="lava-blob lava-blob-2 absolute rounded-full opacity-85"
          style={{
            width: "42%",
            height: "42%",
            top: "35%",
            left: "45%",
            background:
              "radial-gradient(circle at 40% 35%, #fff 0%, #e7cfd4 25%, #6f7579 60%, #181b1d 90%)",
          }}
        />
        <span
          className="lava-blob lava-blob-3 absolute rounded-full opacity-80"
          style={{
            width: "34%",
            height: "34%",
            top: "50%",
            left: "5%",
            background:
              "radial-gradient(circle at 38% 32%, #fff 0%, #d7dde0 22%, #7a858b 55%, #202427 85%)",
          }}
        />
      </div>

      <div
        className="font-display relative z-[1] font-normal"
        style={{ fontSize: "clamp(53px, 7vw, 92px)", letterSpacing: "-2px", textShadow: "0 4px 20px rgba(24,35,47,0.49)" }}
      >
        Virtual <em className="font-normal">Mirror</em>
      </div>
      <div className="relative z-[1] mt-[42px] h-px w-[170px] overflow-hidden bg-white/35">
        <span className="loading-bar-fill block h-full w-[42%] bg-white" />
      </div>
      <p
        className="relative z-[1] mt-3.5 text-[8px] font-bold tracking-[2.1px] text-[#f3f6f6]"
        style={{ textShadow: "0 2px 8px rgba(28,40,49,0.6)" }}
      >
        PREPARING YOUR WARDROBE
      </p>
    </main>
  );
}
