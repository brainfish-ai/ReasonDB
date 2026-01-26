//! RQL error types
//!
//! This module defines error types for the RQL parser and executor.

use std::fmt;

/// Result type for RQL operations.
pub type RqlResult<T> = Result<T, RqlError>;

/// RQL error type.
#[derive(Debug, Clone)]
pub enum RqlError {
    /// Lexer error (invalid token)
    Lexer(LexerError),

    /// Parser error (syntax error)
    Parser(ParserError),

    /// Validation error (semantic error)
    Validation(String),

    /// Execution error
    Execution(String),
}

impl fmt::Display for RqlError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Lexer(e) => write!(f, "Lexer error: {}", e),
            Self::Parser(e) => write!(f, "Parse error: {}", e),
            Self::Validation(msg) => write!(f, "Validation error: {}", msg),
            Self::Execution(msg) => write!(f, "Execution error: {}", msg),
        }
    }
}

impl std::error::Error for RqlError {}

/// Lexer-specific error.
#[derive(Debug, Clone)]
pub struct LexerError {
    /// Error message
    pub message: String,
    /// Line number (1-indexed)
    pub line: usize,
    /// Column number (1-indexed)
    pub column: usize,
    /// The problematic character or token
    pub found: String,
}

impl fmt::Display for LexerError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{} at line {}, column {} (found '{}')",
            self.message, self.line, self.column, self.found
        )
    }
}

impl From<LexerError> for RqlError {
    fn from(e: LexerError) -> Self {
        Self::Lexer(e)
    }
}

/// Parser-specific error.
#[derive(Debug, Clone)]
pub struct ParserError {
    /// Error message
    pub message: String,
    /// What was expected
    pub expected: Option<String>,
    /// What was found
    pub found: Option<String>,
    /// Position in token stream
    pub position: usize,
}

impl ParserError {
    /// Create a new parser error.
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            expected: None,
            found: None,
            position: 0,
        }
    }

    /// Set expected value.
    pub fn expected(mut self, expected: impl Into<String>) -> Self {
        self.expected = Some(expected.into());
        self
    }

    /// Set found value.
    pub fn found(mut self, found: impl Into<String>) -> Self {
        self.found = Some(found.into());
        self
    }

    /// Set position.
    pub fn at(mut self, position: usize) -> Self {
        self.position = position;
        self
    }
}

impl fmt::Display for ParserError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)?;

        if let Some(ref expected) = self.expected {
            write!(f, " (expected {})", expected)?;
        }

        if let Some(ref found) = self.found {
            write!(f, " (found {})", found)?;
        }

        Ok(())
    }
}

impl From<ParserError> for RqlError {
    fn from(e: ParserError) -> Self {
        Self::Parser(e)
    }
}
