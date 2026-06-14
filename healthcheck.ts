const port = process.env.PORT ?? "3000";
const response = await fetch(`http://localhost:${port}/health/live`);
if (response.ok) {
  process.exit(0);
} else {
  process.exit(1);
}
