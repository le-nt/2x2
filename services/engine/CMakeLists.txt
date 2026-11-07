cmake_minimum_required(VERSION 3.20)
project(roblox C CXX ASM)
add_compile_definitions(BOOST_THREAD_PROVIDES_FUTURE_CONTINUATION)

if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    add_compile_definitions(_DEBUG)
endif()

if(ANDROID)
    if(NOT DEFINED ENV{ANDROID_CONTRIB})
        message(FATAL_ERROR "ANDROID_CONTRIB is not defined! Please set it to your libs path.")
    endif()
    set(ANDROID_CONTRIB "$ENV{ANDROID_CONTRIB}/${CMAKE_ANDROID_ARCH_ABI}")
endif()

# We should PROBABLY add a RandomConstant.h you think?
string(TIMESTAMP BUILD_TIME "%s")
string(RANDOM LENGTH 8 ALPHABET 0123456789 RANDOM_SEED ${BUILD_TIME} RANDOM_VALUE)
math(EXPR RBX_BUILDSEED "${RANDOM_VALUE} % 1000000")
set(RANDOM_CONSTANT_H "${CMAKE_SOURCE_DIR}/App/include/security/RandomConstant.h")
if(NOT EXISTS "${RANDOM_CONSTANT_H}")
    file(WRITE "${RANDOM_CONSTANT_H}" "#pragma once\n#define RBX_BUILDSEED ${RBX_BUILDSEED}\n")
endif()
include_directories(${CMAKE_SOURCE_DIR}/App/include/security)
include_directories("${CMAKE_SOURCE_DIR}/Rendering/RbxG3D/include") # todo: NOOOOOOOOOOOOOO this should only be accessible to rendering

# https://github.com/alicevision/geogram/issues/2
# why does this happen...
if(EMSCRIPTEN)
  set(CMAKE_THREAD_LIBS_INIT "-lpthread")
  set(CMAKE_HAVE_THREADS_LIBRARY 1)
  set(CMAKE_USE_WIN32_THREADS_INIT 0)
  set(CMAKE_USE_PTHREADS_INIT 1)
  set(THREADS_PREFER_PTHREAD_FLAG ON)
endif()

option(RCC_BUILD "Build in RCCService mode" OFF)
if(RCC_BUILD)
    message(STATUS "RCC build enabled")
    add_compile_definitions(RBX_RCC_SECURITY)
endif()

option(STUDIO_BUILD "Build in Studio mode" OFF)
if(STUDIO_BUILD)
    message(STATUS "Studio build enabled")
    add_compile_definitions(RBX_STUDIO_BUILD)
endif()

if(MSVC)
  add_compile_options(/bigobj)
endif()

add_definitions(-DBOOST_BIND_GLOBAL_PLACEHOLDERS)
list(APPEND CMAKE_MODULE_PATH "${CMAKE_SOURCE_DIR}/cmake/Modules")

if(CMAKE_CXX_COMPILER_ID MATCHES "Clang" OR CMAKE_CXX_COMPILER_ID STREQUAL "GNU")
  add_compile_options(-Wno-deprecated-declarations)
  add_compile_options(-Wno-nonportable-include-path)
  add_compile_options(-Wno-ignored-attributes)
  add_compile_options(-Wno-undefined-var-template)
  add_compile_options(-Wno-extra-tokens)
  add_compile_options(-Wno-unused-command-line-argument)
  add_compile_options(-Wno-delete-abstract-non-virtual-dtor)
  add_compile_options(-Wno-implicit-const-int-float-conversion)
  add_compile_options(-Wno-return-stack-address)
  add_compile_options(-Wno-nontrivial-memaccess)
  add_compile_options(-Wno-string-plus-int)
  add_compile_options(-Wno-format)
  add_compile_options(-Wno-constant-logical-operand)
endif()

include(FMOD)

if(NOT ANDROID)
  find_package(Boost REQUIRED COMPONENTS random format accumulators bimap filesystem system iostreams thread exception program_options pool circular_buffer math crc numeric_conversion flyweight numeric_ublas foreach REQUIRED)
  find_package(CURL CONFIG REQUIRED)
  find_package(ZLIB REQUIRED)
  find_package(OpenSSL REQUIRED)
  find_package(Freetype REQUIRED)
  find_package(PNG REQUIRED)
else()
  # headers
  include_directories(
      ${ANDROID_CONTRIB}/boost/include
      ${ANDROID_CONTRIB}/zlib/include
      ${ANDROID_CONTRIB}/curl/include
      ${ANDROID_CONTRIB}/openssl/include
      ${ANDROID_CONTRIB}/freetype/include
      ${ANDROID_CONTRIB}/libpng/include
      ${ANDROID_CONTRIB}/sdl2
  )
  # libraries
  link_directories(
      ${ANDROID_CONTRIB}/boost/lib
      ${ANDROID_CONTRIB}/zlib/lib
      ${ANDROID_CONTRIB}/curl/lib
      ${ANDROID_CONTRIB}/openssl/lib
      ${ANDROID_CONTRIB}/freetype/lib
      ${ANDROID_CONTRIB}/libpng/lib
  )
endif()

if(STUDIO_BUILD)
  if(UNIX)
    set(Qt6_DIR "/usr/lib/cmake/Qt6")
    set(Qt6Core_DIR "/usr/lib/cmake/Qt6Core")
    set(Qt6Gui_DIR "/usr/lib/cmake/Qt6Gui")
    set(Qt6Widgets_DIR "/usr/lib/cmake/Qt6Widgets")
    set(Qt6Concurrent_DIR "/usr/lib/cmake/Qt6Concurrent")
    set(Qt6Network_DIR "/usr/lib/cmake/Qt6Network")
    set(Qt6Xml_DIR "/usr/lib/cmake/Qt6Xml")
    set(Qt6WebEngineCore_DIR "/usr/lib/cmake/Qt6WebEngineCore")
    set(Qt6WebEngineWidgets_DIR "/usr/lib/cmake/Qt6WebEngineWidgets")
    set(Qt6WebChannel_DIR "/usr/lib/cmake/Qt6WebChannel")
    set(Qt6Positioning_DIR "/usr/lib/cmake/Qt6Positioning")
    set(Qt6Core5Compat_DIR "/usr/lib/cmake/Qt6Core5Compat")
    set(Qt6OpenGLWidgets_DIR "/usr/lib/cmake/Qt6OpenGLWidgets")
  elseif(WIN32)
    set(Qt6_DIR "C:/Qt/6.8.1/msvc2019_64/lib/cmake/Qt6")
    set(Qt6Core_DIR "C:/Qt/6.8.1/msvc2019_64/lib/cmake/Qt6Core")
    set(Qt6Gui_DIR "C:/Qt/6.8.1/msvc2019_64/lib/cmake/Qt6Gui")  
    set(Qt6Widgets_DIR "C:/Qt/6.8.1/msvc2019_64/lib/cmake/Qt6Widgets")
    set(Qt6Concurrent_DIR "C:/Qt/6.8.1/msvc2019_64/lib/cmake/Qt6Concurrent")
    set(Qt6Network_DIR "C:/Qt/6.8.1/msvc2019_64/lib/cmake/Qt6Network")
    set(Qt6Xml_DIR "C:/Qt/6.8.1/msvc2019_64/lib/cmake/Qt6Xml")
    set(Qt6QmlTools_DIR "C:/Qt/6.8.1/msvc2019_64/lib/cmake/Qt6QmlTools")
    set(Qt6WebEngineCore_DIR "C:/Qt/6.8.1/msvc2019_64/lib/cmake/Qt6WebEngineCore")
    set(Qt6WebEngineWidgets_DIR "C:/Qt/6.8.1/msvc2019_64/lib/cmake/Qt6WebEngineWidgets")
    set(Qt6WebChannel_DIR "C:/Qt/6.8.1/msvc2019_64/lib/cmake/Qt6WebChannel")
    set(Qt6Positioning_DIR "C:/Qt/6.8.1/msvc2019_64/lib/cmake/Qt6Positioning")
    set(Qt6Core5Compat_DIR "C:/Qt/6.8.1/msvc2019_64/lib/cmake/Qt6Core5Compat")
    set(Qt6OpenGLWidgets_DIR "C:/Qt/6.8.1/msvc2019_64/lib/cmake/Qt6OpenGLWidgets")
  endif()

  find_package(Qt6 REQUIRED COMPONENTS
      Core
      GuiPrivate
      Widgets
      Network
      Xml
      WebEngineCore
      WebEngineWidgets
      WebChannel
      Positioning
      Core5Compat
      Concurrent
      OpenGLWidgets
  )
endif()

if(NOT RCC_BUILD AND NOT ANDROID)
  find_package(SDL2 CONFIG REQUIRED)
endif()

if(NOT EMSCRIPTEN AND NOT ANDROID)
  if(WIN32)
    find_package(OpenGL REQUIRED COMPONENTS OpenGL)
  else()
    find_package(OpenGL REQUIRED COMPONENTS OpenGL EGL)
  endif()
endif()

if(EMSCRIPTEN)
  set(USE_FLAGS "--preload-file=${CMAKE_SOURCE_DIR}/.assets/content@/content --preload-file ${CMAKE_SOURCE_DIR}/.assets/shaders@/shaders --preload-file ${CMAKE_SOURCE_DIR}/.assets/PlatformContent@/PlatformContent -sFETCH=1 -sUSE_SDL=2 -sUSE_PTHREADS=1 -fexceptions -msimd128 -msse -msse2 -pthread")
  set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} ${USE_FLAGS}") 
  set(CMAKE_C_FLAGS "${CMAKE_C_FLAGS} ${USE_FLAGS}")
  set(CMAKE_EXE_LINKER_FLAGS "${CMAKE_EXE_LINKER_FLAGS} ${USE_FLAGS}")
  set(CMAKE_EXECUTABLE_SUFFIX .html)
endif()

include_directories(${Boost_INCLUDE_DIRS})
include(ListFilter)
include(IncludeProjectFiles)

if(NOT RBX_SETTINGS_INITIALIZED)
  set(CMAKE_CXX_STANDARD 17)
  set(CMAKE_CXX_STANDARD_REQUIRED ON)
  set(CMAKE_CXX_EXTENSIONS OFF)
  set(RBX_SETTINGS_INITIALIZED TRUE CACHE INTERNAL "" FORCE)
endif(NOT RBX_SETTINGS_INITIALIZED)

add_subdirectory(App)
add_subdirectory(App.BulletPhysics)
add_subdirectory(Base)
add_subdirectory(Log)
add_subdirectory(Rendering)
add_subdirectory(Network)
add_subdirectory(ClientShared)

if(ANDROID)
  add_subdirectory(./Mobile/Android)
  if(CMAKE_ANDROID_ARCH_ABI STREQUAL "armeabi-v7a")
    add_compile_options(
        -mfpu=neon
        -mfloat-abi=softfp
    )
  endif()

  add_library(roblox SHARED
    $<TARGET_OBJECTS:Base>
    $<TARGET_OBJECTS:Log>
    $<TARGET_OBJECTS:App>
    $<TARGET_OBJECTS:Network>
    $<TARGET_OBJECTS:G3D>
    $<TARGET_OBJECTS:AppDraw>
    $<TARGET_OBJECTS:RbxG3D>
    $<TARGET_OBJECTS:GfxBase>
    $<TARGET_OBJECTS:GfxCore>
    $<TARGET_OBJECTS:GfxRender>
    $<TARGET_OBJECTS:Android>
    $<TARGET_OBJECTS:App.BulletPhysics>
  )

  target_link_libraries(roblox
      z
      boost_filesystem
      boost_iostreams
      boost_program_options
      boost_thread
      boost_exception
      boost_chrono
      curl
      ssl
      crypto
      freetype
      png
      fmod
      log
      android
      EGL
      GLESv2
  )
elseif(RCC_BUILD)
  add_subdirectory(RCCService)
elseif(STUDIO_BUILD)
  add_subdirectory(CSG)
  add_subdirectory(QTitanRibbon)
  add_subdirectory(RobloxStudio)
else()
  add_subdirectory(UniversalClient)
endif()

if(UNIX)
  set(RBX_LINKER_DEPENDENCY_FLAGS "-Wl,--no-whole-archive,--no-gc-sections")
endif(UNIX)
