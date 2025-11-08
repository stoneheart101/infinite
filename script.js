document.getElementById('clickme').addEventListener('click', () => {
  const p = document.getElementById('output');
  p.textContent = `Clicked at ${new Date().toLocaleTimeString()}!`;
});