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

  /* Chromium / Safari / Edge */
  *::-webkit-scrollbar {
    width: 8px;
    height: 8px;
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

  /* Prefer dark chrome on scrollable RN-Web nodes */
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
`;

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
