/**
 * Inject BAWAAL orange/black scrollbar CSS for React Native Web.
 * Covers Terms modal and every overflow/ScrollView surface in the browser.
 */
import { Platform } from 'react-native';

const STYLE_ID = 'bawaal-web-scrollbar';

const BAWAAL_SCROLLBAR_CSS = `
  /* Firefox */
  * {
    scrollbar-width: thin;
    scrollbar-color: #FF6600 #0A0A0C;
  }

  /* Chromium / Safari / Edge — vertical chrome only (never a horizontal track) */
  *::-webkit-scrollbar:vertical {
    width: 8px;
  }

  *::-webkit-scrollbar:horizontal {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    background: transparent !important;
  }

  *::-webkit-scrollbar-button {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }

  *::-webkit-scrollbar-track {
    background: #0A0A0C;
  }

  *::-webkit-scrollbar-thumb {
    background-color: #FF6600;
    border-radius: 4px;
    border: 1px solid #0A0A0C;
  }

  *::-webkit-scrollbar-thumb:hover {
    background-color: #FF8533;
  }

  *::-webkit-scrollbar-corner {
    background: #0A0A0C;
  }

  /* Prefer dark chrome on vertical scrollable RN-Web nodes */
  [data-testid],
  div[style*="overflow"],
  .css-view-g5y9jx {
    scrollbar-width: thin;
    scrollbar-color: #FF6600 #0A0A0C;
  }

  .bawaal-terms-scroll,
  .bawaal-terms-scroll * {
    scrollbar-width: thin;
    scrollbar-color: #FF6600 #0A0A0C;
  }

  .bawaal-terms-scroll::-webkit-scrollbar,
  .bawaal-terms-scroll *::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  .bawaal-terms-scroll::-webkit-scrollbar-track,
  .bawaal-terms-scroll *::-webkit-scrollbar-track {
    background: #0A0A0C;
  }

  .bawaal-terms-scroll::-webkit-scrollbar-thumb,
  .bawaal-terms-scroll *::-webkit-scrollbar-thumb {
    background-color: #FF6600;
    border-radius: 4px;
  }

  .bawaal-terms-scroll::-webkit-scrollbar-thumb:hover,
  .bawaal-terms-scroll *::-webkit-scrollbar-thumb:hover {
    background-color: #FF8533;
  }

  /*
   * Arena horizontal shelves / pills — zero track, thumb, or arrow buttons.
   * Applied via className; also force-hide any nested overflow node RN-Web creates.
   */
  .bawaal-hscroll-hidden,
  .bawaal-hscroll-hidden *,
  .bawaal-hscroll-hidden div {
    scrollbar-width: none !important;
    -ms-overflow-style: none !important;
    -webkit-overflow-scrolling: touch;
  }

  .bawaal-hscroll-hidden,
  .bawaal-hscroll-hidden > div,
  .bawaal-hscroll-hidden div[style*="overflow"] {
    overflow-x: auto !important;
    overflow-y: hidden !important;
    padding-bottom: 0 !important;
    margin-bottom: 0 !important;
  }

  .bawaal-hscroll-hidden::-webkit-scrollbar,
  .bawaal-hscroll-hidden *::-webkit-scrollbar,
  .bawaal-hscroll-hidden::-webkit-scrollbar:horizontal,
  .bawaal-hscroll-hidden *::-webkit-scrollbar:horizontal {
    display: none !important;
    width: 0px !important;
    height: 0px !important;
    background: transparent !important;
  }

  .bawaal-hscroll-hidden::-webkit-scrollbar-button,
  .bawaal-hscroll-hidden *::-webkit-scrollbar-button,
  .bawaal-hscroll-hidden::-webkit-scrollbar-track,
  .bawaal-hscroll-hidden *::-webkit-scrollbar-track,
  .bawaal-hscroll-hidden::-webkit-scrollbar-thumb,
  .bawaal-hscroll-hidden *::-webkit-scrollbar-thumb {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    background: transparent !important;
    border: none !important;
  }
`;

/** RN-Web className for Arena horizontal ScrollViews with no scrollbar track. */
export const BAWAAL_HSCROLL_HIDDEN_CLASS = 'bawaal-hscroll-hidden';

export function injectWebScrollbarStyles() {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined' || !document.head) return;
  if (document.getElementById(STYLE_ID)) return;

  try {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.type = 'text/css';
    style.appendChild(document.createTextNode(BAWAAL_SCROLLBAR_CSS));
    document.head.appendChild(style);
  } catch (err) {
    console.warn(
      '[webScrollbar] inject failed:',
      err?.message || err
    );
  }
}

export default injectWebScrollbarStyles;
