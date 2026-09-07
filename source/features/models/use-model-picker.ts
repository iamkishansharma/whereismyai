import { createRef } from 'react';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

/**
 * The picker is a single sheet mounted by the chat screen, but it is opened
 * from the composer, the welcome card and the stack header — none of which can
 * reach a ref held by the others, so the handle lives here.
 *
 * Driven imperatively, the same way the composer drives its attachment sheet.
 * Mirroring state into a store and calling present/dismiss from an effect
 * fires a dismiss on mount, which leaves the modal stack out of step.
 */
export const modelPickerSheetRef = createRef<BottomSheetModal>();

export function openModelPicker(): void {
  modelPickerSheetRef.current?.present();
}

export function closeModelPicker(): void {
  modelPickerSheetRef.current?.dismiss();
}
