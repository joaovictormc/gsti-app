const bcrypt = require('bcrypt');
const saltRounds = 10;
const passwordToHash = 'joaovmc98'; // <<< COLOQUE SUA SENHA AQUI

bcrypt.hash(passwordToHash, saltRounds, function(err, hash) {
    if (err) {
        console.error("Erro ao gerar hash:", err);
    } else {
        console.log("Senha:", passwordToHash);
        console.log("Hash Gerado:", hash);
        console.log("\nCopie o Hash Gerado e use no comando INSERT SQL.");
    }
});