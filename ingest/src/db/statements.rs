pub type STATEMENT = &'static str;

#[derive(Debug, Clone)]
pub enum QueryParam {
    Integer(i64),
    Float(f64),
    Text(String),
    Boolean(bool),
}

#[derive(Debug, PartialEq)]
pub enum QueryBuildError {
    PlaceholderMismatch { expected: usize, found: usize },
}

/// Safely replaces multiple '?' placeholders in a SQL statement with sequential, sanitized parameters.
pub fn safe_replace_many(
    statement: STATEMENT,
    params: &[QueryParam],
) -> Result<String, QueryBuildError> {
    let expected_placeholders = statement.matches('?').count();
    if expected_placeholders != params.len() {
        return Err(QueryBuildError::PlaceholderMismatch {
            expected: expected_placeholders,
            found: params.len(),
        });
    }

    let mut result = statement.to_string();

    for param in params {
        let escaped_value = match param {
            QueryParam::Integer(val) => val.to_string(),
            QueryParam::Float(val) => val.to_string(),
            QueryParam::Boolean(val) => val.to_string().to_uppercase(),
            QueryParam::Text(val) => {
                let sanitized = val.replace("'", "''");
                format!("'{}'", sanitized)
            }
        };

        result = result.replacen("?", &escaped_value, 1);
    }

    Ok(result)
}

pub static CHECK: STATEMENT = "SELECT 1";
pub static USERS: STATEMENT = "SELECT * FROM USER";
pub static USER_BY_ID: STATEMENT = "select * from user where id = ?";
