#pragma once

#include <string>

namespace RBX
{
	class Crypt
	{
	public:
		Crypt();
		~Crypt();
		void verifySignatureHex(const std::string& message, const std::string& signatureHex);
	};
}


