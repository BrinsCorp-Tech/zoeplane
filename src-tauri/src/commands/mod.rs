// ZoePlane — IPC command modules
//
// Each sub-module groups related Tauri commands. Register commands exported
// from here in the `invoke_handler!` macro in lib.rs.

pub mod assets;
pub mod editor;
pub mod fs;
pub mod project;
