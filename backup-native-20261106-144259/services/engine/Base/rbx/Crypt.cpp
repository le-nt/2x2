#include "rbx/Crypt.h"
#include <openssl/hmac.h>
#include <openssl/evp.h>
#include <openssl/crypto.h>
#include <string>
#include <stdexcept>
#include <vector>
#include <iostream>
#include <sstream>
#include <iomanip>

namespace RBX
{

Crypt::Crypt() {}
Crypt::~Crypt() {}

static std::vector<unsigned char> hexToBytes(const std::string& hex) {
    if (hex.size() % 2 != 0)
        throw std::invalid_argument("Hex string must have even length");

    std::vector<unsigned char> bytes;
    bytes.reserve(hex.size() / 2);

    for (size_t i = 0; i < hex.size(); i += 2) {
        unsigned int byte;
        std::stringstream ss;
        ss << std::hex << hex.substr(i, 2);
        ss >> byte;
        bytes.push_back(static_cast<unsigned char>(byte));
    }

    return bytes;
}

void Crypt::verifySignatureHex(const std::string& message, const std::string& signatureHex) {
    const char* envKey = std::getenv("RBX_SECRET_KEY");
    if (!envKey)
        return;

    const std::string secretKey(envKey);
    std::vector<unsigned char> signature = hexToBytes(signatureHex);

    unsigned char hmacResult[EVP_MAX_MD_SIZE];
    unsigned int hmacLength = 0;

    HMAC(EVP_sha256(),
         secretKey.data(), (int)secretKey.size(),
         reinterpret_cast<const unsigned char*>(message.data()), message.size(),
         hmacResult, &hmacLength);

    if (signature.size() != hmacLength || CRYPTO_memcmp(signature.data(), hmacResult, hmacLength) != 0)
        throw std::runtime_error("");
}

}