function average(arr) {
  return arr.reduce((sum, value) => sum + value) / arr.length;
}

function standardDiv(arr) {
  const avg = average(arr);
  const diffSq = arr.map((v) => Math.pow(v - avg, 2));
  return Math.sqrt(average(diffSq));
}
