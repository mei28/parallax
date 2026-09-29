import type { FC, ReactNode } from "react";

// Sizes are the listing images' (store-assets/build_screenshots.py) at 1.5x: the window there
// is 1152px wide in a 1280px image, here 1728px in 1920, so the panes read the same.

const ADDRESS = "example.com/notes-on-reading";

const Dot: FC = () => (
  <div style={{ width: 15, height: 15, borderRadius: "50%", background: "#cfcfd3" }} />
);

/** A browser window's frame, the traffic lights and the address, around what it shows. */
export const BrowserWindow: FC<{ children: ReactNode }> = ({ children }) => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      borderRadius: "21px 21px 0 0",
      background: "#fff",
      color: "#17171c",
      boxShadow: "0 -1.5px 0 rgb(255 255 255 / 22%) inset, 0 45px 105px rgb(0 0 0 / 45%)",
    }}
  >
    <div
      style={{
        flex: "0 0 45px",
        display: "flex",
        alignItems: "center",
        gap: 10.5,
        padding: "0 19.5px",
        background: "#ececed",
        borderBottom: "1.5px solid #dcdcde",
      }}
    >
      <Dot />
      <Dot />
      <Dot />
      <div
        style={{
          marginLeft: 15,
          padding: "4.5px 18px",
          borderRadius: 7.5,
          background: "#fff",
          fontSize: 16.5,
          color: "#6a6a72",
        }}
      >
        {ADDRESS}
      </div>
    </div>
    <div style={{ position: "relative", flex: 1, minHeight: 0 }}>{children}</div>
  </div>
);
