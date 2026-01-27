# iCloud Notes

This project offers a native Windows application via Electron for accessing iCloud notes, reminders, and other content available on [icloud.com](https://www.icloud.com/). 
Unlike Apple's official iCloud for Windows, which focuses on managing iCloud Drive, Photos, and Bookmarks, this client specifically targets note-taking and always defaults to iCloud Notes.

## Features

- **System Tray Integration**: The app runs in the system tray, keeping your iCloud session alive even when the window is closed. This helps maintain your login state longer.
- **Click to Toggle**: Click the tray icon to show/hide the main window.
- **Right-Click Menu**: Right-click the tray icon to access quick options:
  - **Show iCloud Notes**: Opens the main window.
  - **Quit**: Fully exits the application.
- **Start with Windows**: Once signed in, the app can be will start automatically with Windows.

## Setup

1. **Releases**: Download the latest release of the application.
2. **Sign in to your iCloud account**: Upon launching the application, sign in to your iCloud account to access your notes and reminders.
3. **Enjoy!**: Once signed in, you can seamlessly view and manage your iCloud notes within the Windows environment.

**Note**: Closing the window hides the app to the system tray instead of quitting. To fully exit, right-click the tray icon and select "Quit".

## Development

Ensure that Node.js is installed on your system to run the application.

1. Clone this repository to your local machine.
2. Navigate to the project directory in your terminal.
3. Run `npm install` to install the required dependencies.

To run the Electron application:

```npm run start```

## Creating Releases

1. Ensure Windows Developer Mode is enabled in Settings.
2. Run `npm run release` to create the Windows installer.

## Contributing

Contributions to enhance the application's functionality or address any issues are welcome. Feel free to open an issue or create a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
