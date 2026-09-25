use std::path::{Path, PathBuf};
use std::time::Instant;

use anyhow::Result;
use clap::{Parser, Subcommand};
use gyotaku_core::Index;
use gyotaku_ocr::Ocr;

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
    /// Read the text out of one image and print it, without indexing anything
    Ocr {
        image: PathBuf,
        /// Also print each line's box (x y w h, as fractions of the image) and score
        #[arg(long)]
        boxes: bool,
        #[arg(long, default_value_t = 4)]
        threads: usize,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();
    if let Command::Ocr {
        image,
        boxes,
        threads,
    } = &cli.command
    {
        return ocr(image, *boxes, *threads);
    }

    let index = Index::open_default()?;
    match cli.command {
        Command::Ocr { .. } => unreachable!(),
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

fn ocr(path: &Path, boxes: bool, threads: usize) -> Result<()> {
    let t = Instant::now();
    let mut ocr = Ocr::new(threads)?;
    let load = t.elapsed();

    let t = Instant::now();
    let img = gyotaku_ocr::load_image(path)?;
    let decode = t.elapsed();

    let t = Instant::now();
    let lines = ocr.read(&img)?;
    let read = t.elapsed();

    for l in &lines {
        if boxes {
            let r = l.rect;
            println!(
                "{:.3} {:.3} {:.3} {:.3}  {:.2}  {}",
                r.x, r.y, r.w, r.h, l.score, l.text
            );
        } else {
            println!("{}", l.text);
        }
    }
    eprintln!(
        "{} lines, models {:.0?}, decode {:.0?}, ocr {:.0?}",
        lines.len(),
        load,
        decode,
        read
    );
    Ok(())
}
