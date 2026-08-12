// src/utils/uiHelpers.ts
export const truncateName = (name: string, maxLength: number = 6): string => {
  if (!name) return '';
  if (name.length > maxLength) {
    return name.substring(0, maxLength);
  }
  return name;
};