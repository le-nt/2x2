#include "RbxFormat.h"
#include <cassert>
#include <string>

static void verifyCallerArguments(const char* expected, const char* fmt, ...)
{
    va_list args;
    va_start(args, fmt);
    assert(RBX::vformat(fmt, args) == expected);
    assert(RBX::vformat(fmt, args) == expected);
    va_end(args);
}

int main()
{
    assert(RBX::format(nullptr).empty());
    for (size_t size : {size_t(159), size_t(160), size_t(161), size_t(512), size_t(4096)})
    {
        const std::string prefix(size, 'x');
        const std::string expected = prefix + "?placeId=278&type=standard&scope=validation&target=object&valueLength=6";
        assert(RBX::format("%s?placeId=%i&type=%s&scope=%s&target=%s&valueLength=%u",
            prefix.c_str(), 278, "standard", "validation", "object", 6u) == expected);
        verifyCallerArguments(expected.c_str(), "%s?placeId=%i&type=%s&scope=%s&target=%s&valueLength=%u",
            prefix.c_str(), 278, "standard", "validation", "object", 6u);
    }
    const std::string huge(1000100, 'x');
    assert(RBX::format("%s", huge.c_str()) == huge.substr(0, 1000000));
}
