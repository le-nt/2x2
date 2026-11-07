"""Compile the real URL builders with lightweight dependency stubs, not the engine.

Checks RCC routing and that client builds retain their existing behavior.
"""
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

SOURCE=Path(__file__).resolve().parents[1]/'services/engine/ClientShared/RobloxServicesTools.cpp'

@unittest.skipUnless(shutil.which('g++'),'g++ is required for the URL-builder harness')
class ChatUrlTests(unittest.TestCase):
    def test_worker_and_client_builds(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            (root/'util').mkdir();(root/'boost/algorithm/string').mkdir(parents=True)
            (root/'stdafx.h').write_text('')
            (root/'util/URL.h').write_text('''#include <string>
namespace RBX { struct Url { static Url fromString(const std::string&) { return Url(); }
std::string domain() const { return "example.test"; } }; }
''')
            (root/'boost/algorithm/string/predicate.hpp').write_text('''#include <string>
namespace boost { namespace algorithm {
bool starts_with(const std::string& a,const std::string& b){return a.compare(0,b.size(),b)==0;}
bool ends_with(const std::string& a,const std::string& b){return a.size()>=b.size()&&a.compare(a.size()-b.size(),b.size(),b)==0;}
} }
''')
            main=root/'main.cpp'
            main.write_text('''#include <cassert>
#include <cstdlib>
#include <cstdio>
#include <cstdarg>
#include <string>
std::string format_string(const char* fmt,...){char out[2048];va_list args;va_start(args,fmt);vsnprintf(out,sizeof(out),fmt,args);va_end(args);return out;}
'''+'#include "'+SOURCE.as_posix()+'"\n'+'''
int main(){
 unsetenv("RBX_INTERNAL_BASE_URL");
 assert(GetPlayerGameDataUrl("https://example.test",2)=="https://www.example.test/api/game/players/2");
 setenv("RBX_INTERNAL_BASE_URL","https://2x2.example.test:8443/native/",1);
#ifdef RBX_RCC_SECURITY
 assert(GetPlayerGameDataUrl("https://wrong.test",2)=="https://2x2.example.test:8443/native/api/game/players/2");
 assert(GetWebChatFilterURL("https://wrong.test")=="https://2x2.example.test:8443/native/api/moderation/filtertext");
 setenv("RBX_INTERNAL_BASE_URL","http://127.0.0.1:8090/native",1);
 assert(GetWebChatFilterURL("https://wrong.test")=="http://127.0.0.1:8090/native/api/moderation/filtertext");
#else
 assert(GetPlayerGameDataUrl("https://example.test",2)=="https://www.example.test/api/game/players/2");
 assert(GetWebChatFilterURL("https://example.test")=="https://www.example.test/api/moderation/filtertext");
#endif
 setenv("RBX_INTERNAL_BASE_URL","",1);
 assert(GetWebChatFilterURL("https://example.test")=="https://www.example.test/api/moderation/filtertext");
}
''')
            for defines in ([],['-DRBX_RCC_SECURITY']):
                exe=root/'urls'
                subprocess.run(['g++','-std=c++11','-I',str(root),*defines,str(main),'-o',str(exe)],check=True,capture_output=True)
                subprocess.run([str(exe)],check=True,capture_output=True)

if __name__=='__main__':unittest.main()
