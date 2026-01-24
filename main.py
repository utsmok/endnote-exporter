import flet as ft
from endnote_exporter import export_references_to_xml
from pathlib import Path

_LOG_FILE = Path(__file__).parent / "logs" / "endnote_exporter.log"

def count_errors() -> tuple[int, list[str]]:
    """Counts warnings and errors in the log file."""
    errors = 0
    error_lines = []
    if _LOG_FILE.exists():
        with _LOG_FILE.open("r", encoding="utf-8") as lf:
            for line in lf:
                if not line:
                    continue
                lowered_line = line.lower()
                if "warning" in lowered_line or "error" in lowered_line:
                    try:
                        # Get the message part only
                        message = line.strip().split(" | ", 2)[-1]
                        errors += 1
                        error_lines.append(message.strip())
                    except IndexError:
                        continue # Ignore malformed log lines
    return errors, error_lines

def main(page: ft.Page):
    page.title = "EndNote Exporter"
    page.window_width = 600
    page.window_height = 500
    page.theme_mode = ft.ThemeMode.LIGHT

    # State variables
    enl_path = ft.Ref[str]()

    # UI Elements
    log_view = ft.ListView(expand=True, spacing=10, auto_scroll=True)

    def on_dialog_result(e: ft.FilePickerResultEvent):
        if e.files:
            file_path = e.files[0].path
            enl_path.current = file_path
            status_text.value = f"Selected: {Path(file_path).name}"
            export_btn.disabled = False
            page.update()

    file_picker = ft.FilePicker(on_result=on_dialog_result)

    def on_save_result(e: ft.FilePickerResultEvent):
        if e.path:
            output_path = Path(e.path)
            export_btn.disabled = True
            progress_ring.visible = True
            page.update()

            pre_run_errors, _ = count_errors()

            try:
                # Run this in a thread ideally, but Flet handles simple callbacks well
                count, out_file = export_references_to_xml(Path(enl_path.current), output_path)
                log_view.controls.append(ft.Text(f"Success! Exported {count} items to {out_file}", color="green"))

                post_run_errors, post_error_lines = count_errors()
                new_errors = post_run_errors - pre_run_errors
                if new_errors > 0:
                    log_view.controls.append(ft.Text(f"Export completed with {new_errors} warnings/errors:", color="orange"))
                    for error in post_error_lines[-new_errors:]:
                        log_view.controls.append(ft.Text(f"- {error}", color="orange"))

            except Exception as ex:
                 log_view.controls.append(ft.Text(f"Error: {ex}", color="red"))

            progress_ring.visible = False
            export_btn.disabled = False
            page.update()

    save_file_picker = ft.FilePicker(on_result=on_save_result)

    page.overlay.append(file_picker)
    page.overlay.append(save_file_picker)

    def run_export(e):
        default_xml_name = f"{Path(enl_path.current).stem}_zotero_export.xml"
        save_file_picker.save_file(
            dialog_title="Save Exported XML As",
            file_name=default_xml_name,
            allowed_extensions=["xml"]
        )

    # Layout
    status_text = ft.Text("Please select an .enl file")
    export_btn = ft.ElevatedButton("Export to XML", on_click=run_export, disabled=True)
    progress_ring = ft.ProgressRing(visible=False)

    page.add(
        ft.Column([
            ft.Text("EndNote to Zotero", size=30, weight="bold"),
            ft.Container(
                content=ft.Column([
                    ft.ElevatedButton("Select Library", on_click=lambda _: file_picker.pick_files(allow_multiple=False, allowed_extensions=["enl"])),
                    status_text,
                ]),
                padding=20,
                bgcolor=ft.colors.BLUE_GREY_50,
                border_radius=10
            ),
            export_btn,
            progress_ring,
            ft.Divider(),
            ft.Text("Logs:"),
            ft.Container(content=log_view, height=200, border=ft.border.all(1, "grey"), border_radius=5)
        ])
    )

ft.app(target=main)
