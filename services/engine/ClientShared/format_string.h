#pragma once

#include <cstdarg>
#include <string>
#include <fstream>
#include <vector>

std::string vformat(const char *fmt, va_list argPtr);
std::wstring vformat(const wchar_t *fmt, va_list argPtr);

std::string format_string(const char* fmt,...);
std::wstring format_string(const wchar_t* fmt,...);

std::string convert_w2s(const std::wstring &str);
std::wstring convert_s2w(const std::string &str);

std::vector<std::string> splitOn(
    const std::string&  str,
    const char&         delimeter,
    const bool          trimEmpty = true );

std::vector<std::wstring> splitOn(
    const std::wstring& str,
    const wchar_t&      delimeter,
    const bool          trimEmpty = true );

#ifdef UNICODE	
#define CVTW2S(value) convert_w2s(value)
#else
#define CVTW2S(value) (value)
#endif

#ifdef UNICODE	
#define CVTS2W(value) convert_s2w(value)
#else
#define CVTS2W(value) (value)
#endif

#ifdef UNICODE
#define MAKE_STRING(value) std::wstring(L##value)
#else
#define MAKE_STRING(value) std::string(value)
#endif

template<class CHARTYPE>
class simple_logger
{
	typedef std::basic_string<CHARTYPE, std::char_traits<CHARTYPE>, std::allocator<CHARTYPE> > STRING;
private:
	void write_logentry_raw(const char *entry)
	{
	}

	STRING logFileName;
	std::ofstream log;
public:
	simple_logger() :
	  logFileName(get_temp_filename(MAKE_STRING("log").c_str())),
	  log(logFileName.c_str())
	{
	}

	simple_logger(const CHARTYPE *fileName) :
		logFileName(fileName),
		log(logFileName.c_str())
	{
	}
	
	static STRING get_tmp_path()
	{
		return STRING(MAKE_STRING(""));
	}

	static STRING get_temp_filename(const CHARTYPE* ext)
	{
		return STRING(MAKE_STRING(""));
	}

	void write_logentry(const char *format, ...)
	{
		va_list argList;
		va_start(argList, format);
		std::string result = vformat(format, argList);
		write_logentry_raw(result.c_str());
		va_end(argList);
	}

	STRING &log_filename() {return logFileName;}
};