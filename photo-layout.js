export function photoRows(ratios, width, target = 210, gap = 18) {
  const rows = [];
  let row = [], sum = 0;
  for (const ratio of ratios) {
    row.push(ratio); sum += ratio;
    const height = (width - gap * (row.length - 1)) / sum;
    if (height <= target) {
      rows.push({ ratios: row, height }); row = []; sum = 0;
    }
  }
  if (row.length) rows.push({ ratios: row, height: Math.min(target, (width - gap * (row.length - 1)) / sum) });
  return rows;
}
