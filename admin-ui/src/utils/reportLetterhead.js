import headerUrl from '../assets/report-letterhead-header.jpg';
import footerUrl from '../assets/report-letterhead-footer.png';

// Aspect ratios (height / width) of the two banner images, extracted
// pixel-for-pixel from the CED letterhead PDF (a portrait Letter page).
const HEADER_ASPECT = 328 / 1708;
const FOOTER_ASPECT = 80 / 796;

// Physical width (mm) of the portrait Letter page the banner images were
// captured from. Band heights are derived from THIS fixed width rather
// than the doc's own page width, so the bands keep the CED template's true
// physical thickness even on pages narrower or wider than a portrait Letter
// page (e.g. a report that ends up exporting landscape for a wide table).
const TEMPLATE_PAGE_WIDTH_MM = 215.9;

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
    cachedImages = Promise.all([toDataUrl(headerUrl), toDataUrl(footerUrl)])
      .then(([header, footer]) => ({ header, footer }))
      .catch((err) => {
        cachedImages = null;
        throw err;
      });
  }
  return cachedImages;
}

/** Header/footer band heights (in the doc's page units), fixed to the template's physical size. */
export function getLetterheadLayout(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  return {
    pageWidth,
    headerHeight: TEMPLATE_PAGE_WIDTH_MM * HEADER_ASPECT,
    footerHeight: TEMPLATE_PAGE_WIDTH_MM * FOOTER_ASPECT,
  };
}

/** Draws the CED letterhead header/footer bands on the doc's current page. */
export function drawLetterheadBands(doc, images) {
  const { pageWidth, headerHeight, footerHeight } = getLetterheadLayout(doc);
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.addImage(images.header, 'JPEG', 0, 0, pageWidth, headerHeight);
  doc.addImage(images.footer, 'PNG', 0, pageHeight - footerHeight, pageWidth, footerHeight);
}
