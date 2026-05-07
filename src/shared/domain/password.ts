const COMMON_PASSWORDS = new Set([
  "password", "123456", "12345678", "qwerty", "abc123", "monkey", "master",
  "dragon", "111111", "baseball", "iloveyou", "trustno1", "sunshine",
  "ashley", "football", "shadow", "123123", "654321", "superman",
  "qazwsx", "michael", "password1", "password123", "welcome", "hello",
  "charlie", "donald", "login", "qwerty123", "admin", "admin123",
  "letmein", "access", "flower", "passw0rd", "test", "princess",
  "changeme", "1234", "12345", "123456789", "1234567890", "p@ssw0rd",
  "p@ssword", "p@ss", "pass123", "pass1234", "iloveu", "000000",
  "queen", "king", "zxcvbn", "asdfgh", "987654321", "secret",
  "summer", "winter", "spring", "autumn", "soccer", "hockey",
  "ranger", "buster", "thomas", "robert", "jordan", "daniel",
  "andrea", "joshua", "pepper", "starwars", "silver", "william",
  "dallas", "yankees", "jordan23", "eagles", "fishing", "999999",
  "1q2w3e4r", "1q2w3e", "qwerty1", "zaq12wsx", "qweasdzxc",
  "555555", "lovely", "7777777", "888888", "666666", "121212",
  "freedom", "love", "god", "money", "matrix", "cocacola", "samsung",
  "computer", "internet", "service", "mustang", "hunter", "killer",
  "trustme", "tigger", "ranger", "thunder", "tigers", "packers",
  "cheese", "butter", "orange", "banana", "lakers", "giants",
  "yankees2", "dolphins", "jackson", "sparky", "buffalo", "chicken",
  "marina", "pear", "apple", "peach", "mango", "cherry",
  "cookie123", "chocolate", "snoopy", "scooby", "mickey", "goofy",
  "batman", "superman1", "wonder", "gandalf", "mercedes", "ferrari",
  "porsche", "toyota", "corvette", "diamond", "golden", "silver1",
  "platinum", "copper", "austin", "berlin", "london", "boston",
  "chicago", "detroit", "houston", "orlando", "phoenix", "tucson",
]);

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  if (password.length < 12) {
    errors.push("La contrasena debe tener al menos 12 caracteres");
  }
  if (password.length > 128) {
    errors.push("La contrasena no puede tener mas de 128 caracteres");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("La contrasena debe contener al menos una letra mayuscula");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("La contrasena debe contener al menos una letra minuscula");
  }
  if (!/\d/.test(password)) {
    errors.push("La contrasena debe contener al menos un numero");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push("La contrasena debe contener al menos un caracter especial");
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase().replace(/[^a-z0-9]/g, ""))) {
    errors.push("La contrasena es demasiado comun, elige una mas segura");
  }

  return { valid: errors.length === 0, errors };
}
