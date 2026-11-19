// Wartet, bis Redmine nach einem Neustart wieder antwortet.
// Redmine kompiliert geänderte Theme-Assets nur beim Start neu.

const url = `${process.env.REDMINE_URL ?? 'http://localhost:3080'}/login`;
const deadline = Date.now() + 90_000;

while (Date.now() < deadline) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      console.log('Redmine ist bereit.');
      process.exit(0);
    }
  } catch {
    // Server startet noch
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

console.error('Redmine antwortet nicht.');
process.exit(1);
