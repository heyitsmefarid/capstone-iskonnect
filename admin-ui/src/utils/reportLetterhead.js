import headerUrl from '../assets/report-letterhead-header.jpg';
import footerUrl from '../assets/report-letterhead-footer.png';

// Aspect ratios (height / width) of the two banner images, extracted
// pixel-for-pixel from the CED letterhead PDF (a portrait Letter page).
// Reports export landscape to fit wide tables, so these bands are scaled
// UNIFORMLY (same factor on both axes) to fill the page width — this keeps
// the round seals circular instead of stretching them into ovals.
const HEADER_ASPECT = 328 / 1708;
const FOOTER_ASPECT = 80 / 796;

let cachedImages = null;

function toDataUrl(url) {
  return fetch(url)
    .then((res) => res.blob())
    .then(
      (blob) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        })
    );
}

/** Loads (and caches) the CED letterhead banner images as data URLs for jsPDF. */
export function loadLetterheadImages() {
  if (!cachedImages) {
    cachedImages = Promise.all([toDataUrl(headerUrl), toDataUrl(footerUrl)]).then(
      ([header, footer]) => ({ header, footer })
    );
  }
  return cachedImages;
}

/** Header/footer band heights (in the doc's page units) for the doc's current page width. */
export function getLetterheadLayout(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  return {
    pageWidth,
    headerHeight: pageWidth * HEADER_ASPECT,
    footerHeight: pageWidth * FOOTER_ASPECT,
  };
}

/** Draws the CED letterhead header/footer bands on the doc's current page. */
export function drawLetterheadBands(doc, images) {
  const { pageWidth, headerHeight, footerHeight } = getLetterheadLayout(doc);
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.addImage(images.header, 'JPEG', 0, 0, pageWidth, headerHeight);
  doc.addImage(images.footer, 'PNG', 0, pageHeight - footerHeight, pageWidth, footerHeight);
}
