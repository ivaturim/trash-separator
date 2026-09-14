/**
 * `jpeg-js` ships no types, and only its decoder is imported directly so the
 * encoder (which needs a Node `Buffer`) never reaches the bundle.
 */
declare module "jpeg-js/lib/decoder" {
  type DecodedJpeg = {
    width: number;
    height: number;
    data: Uint8Array;
  };

  type DecodeOptions = {
    /** Required in React Native: the alternative allocates a Node `Buffer`. */
    useTArray?: boolean;
    formatAsRGBA?: boolean;
    maxMemoryUsageInMB?: number;
    maxResolutionInMP?: number;
  };

  export default function decode(
    data: Uint8Array | ArrayBuffer,
    options?: DecodeOptions,
  ): DecodedJpeg;
}
