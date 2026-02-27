export const formatDateWithDots = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/(\d)-(?=\d)/g, '$1.');
};
