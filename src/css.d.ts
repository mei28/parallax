// esbuild's text loader turns .css imports into strings so the overlay stylesheet can be
// injected into a closed shadow root without a separate file.
declare module "*.css" {
  const contents: string;
  export default contents;
}
