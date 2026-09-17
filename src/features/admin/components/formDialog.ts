/**
 * Layout for the admin create/edit dialogs, shared so the two forms cannot
 * drift. The generated DialogContent is a p-4 card sized for a confirm
 * prompt; these turn it into a form card whose field list scrolls while the
 * header and footer stay in view.
 */

/** Card-sized, and a flex column so only the field list scrolls. */
export const formDialogContentClass =
  "flex max-h-[85vh] flex-col gap-0 rounded-lg p-6 sm:max-w-lg"

/** Undoes the content padding so the scrollbar sits at the dialog edge. */
export const formDialogBodyClass =
  "-mx-6 mt-5 min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-1"

/** The generated footer is offset for p-4; these dialogs use p-6. */
export const formDialogFooterClass = "-mx-6 -mb-6 mt-5 rounded-b-lg px-6 py-4"
