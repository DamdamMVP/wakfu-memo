/** Proof that clicks land: the lock never touches this surface. */
let clics = 0;
const bouton = document.getElementById('preuve');
bouton?.addEventListener('click', () => {
  clics += 1;
  bouton.textContent = `Cliqué ${clics} fois`;
});

export {};
