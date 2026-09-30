// Estimated real-row metrics fed to <TableSkeleton> so loading -> loaded does
// not shift. Derived from markup (py-2.5 cells + tallest cell content + 1px
// border); re-measure in the browser if the row markup changes.

/** Bookings desktop row: 20px padding + 28px actions button + 1px border. */
export const BOOKINGS_SKELETON = { rowHeight: 49, cardFields: 4 } as const;

/** Inquiry desktop row: 20px padding + name/email 2-line cell (35px) + 1px border. */
export const INQUIRIES_SKELETON = { rowHeight: 56, cardFields: 3 } as const;
