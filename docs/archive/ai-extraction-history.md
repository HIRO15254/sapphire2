> Historical snapshot. Current guidance: [ai-extraction](../design/ai-extraction.md).

# AI extraction history

The former tournament form merged extracted data over the user's live form values (SA2-77). It ignored blank extracted strings and preserved fields not supplied by extraction. Zero was meaningful for non-negative fields such as buy-in and entry fee, but was ignored as filler for starting stack and table size. Using the live values, rather than the form's initial values, preserved edits made after the form opened.

The old form and its merge helper were deleted with the old UI in B03 (SA2-387). This describes the retired implementation, not a current web integration.
