use anyhow::Result;
use clap::{Parser, Subcommand};
use gyotaku_core::Index;

#[derive(Parser)]
#[command(version, about)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Find screenshots containing every word of the query
    Search {
        #[arg(required = true)]
        query: Vec<String>,
        #[arg(short = 'n', long, default_value_t = 20)]
        limit: usize,
    },
    /// Show where the index lives and how much is in it
    Stats,
}

fn main() -> Result<()> {
    let index = Index::open_default()?;

    match Cli::parse().command {
        Command::Search { query, limit } => {
            for hit in index.search(&query.join(" "), limit)? {
                println!("{}", hit.path.display());
                for line in &hit.lines {
                    println!("    {}", line.text);
                }
            }
        }
        Command::Stats => {
            println!(
                "index  {}",
                gyotaku_core::data_dir()?.join("index.db").display()
            );
            println!("shots  {}", index.len()?);
        }
    }
    Ok(())
}
