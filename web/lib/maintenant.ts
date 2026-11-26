export function maintenant(): Date {
  const decalage = Number(process.env.DATE_DECALAGE_MOIS ?? 0);
  const date = new Date();
  if (decalage) date.setMonth(date.getMonth() - decalage);
  return date;
}
