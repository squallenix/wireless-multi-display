#include <windows.h>
#include <iostream>
#include <string>

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cerr << "Usage: desktop_runner.exe <command line>" << std::endl;
        return 1;
    }

    // Build the full command line from argv[1..]
    std::string cmdLine = "";
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg.find(' ') != std::string::npos || arg.find('"') != std::string::npos) {
            cmdLine += "\"" + arg + "\" ";
        } else {
            cmdLine += arg + " ";
        }
    }

    STARTUPINFOA si = {0};
    si.cb = sizeof(si);
    si.lpDesktop = (LPSTR)"WinSta0\\Default";
    si.dwFlags = STARTF_USESTDHANDLES;
    si.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
    si.hStdOutput = GetStdHandle(STD_OUTPUT_HANDLE);
    si.hStdError = GetStdHandle(STD_ERROR_HANDLE);

    PROCESS_INFORMATION pi = {0};

    BOOL success = CreateProcessA(
        NULL,
        const_cast<char*>(cmdLine.c_str()),
        NULL,
        NULL,
        TRUE, // inherit handles for stdin/stdout pipes
        0,
        NULL,
        NULL,
        &si,
        &pi
    );

    if (!success) {
        DWORD err = GetLastError();
        std::cerr << "[desktop_runner] CreateProcess failed: " << err << std::endl;
        return err;
    }

    WaitForSingleObject(pi.hProcess, INFINITE);

    DWORD exitCode = 0;
    GetExitCodeProcess(pi.hProcess, &exitCode);

    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);

    return exitCode;
}
