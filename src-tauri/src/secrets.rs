pub fn store_secret(service: &str, key: &str, value: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(service, key)
        .map_err(|e| format!("Failed to initialize keyring entry: {e}"))?;
    entry
        .set_password(value)
        .map_err(|e| format!("Failed to store secret in keyring: {e}"))
}

pub fn get_secret(service: &str, key: &str) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(service, key)
        .map_err(|e| format!("Failed to initialize keyring entry: {e}"))?;

    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to read secret from keyring: {e}")),
    }
}

pub fn delete_secret(service: &str, key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(service, key)
        .map_err(|e| format!("Failed to initialize keyring entry: {e}"))?;

    match entry.delete_password() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Failed to delete keyring secret: {e}")),
    }
}
