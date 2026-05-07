const response = await fetch("http://localhost:3000/health/live");
if (response.ok) {
  process.exit(0);
} else {
  process.exit(1);
}
